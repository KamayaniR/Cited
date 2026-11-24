import "server-only";
import { vendorFetch } from "@/lib/monitor";
import type { z } from "zod";
import { env, isLive } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";

export interface LlmResult<T> { data: T; tokens: number; costUsd: number; mode: "live" | "mock"; provider?: "anthropic" | "moss" | "mock" }

/** Which LLM runs: Claude when ANTHROPIC_API_KEY is set, otherwise Moss Inference when Moss keys are set, otherwise mock. */
export function llmProvider(): "anthropic" | "moss" | "mock" {
  if (!isLive("llm")) return "mock";
  return env.anthropicKey ? "anthropic" : "moss";
}

async function mossComplete(system: string, prompt: string, maxTokens: number) {
  const { MossInference } = await import("@moss-js/moss");
  const client = new MossInference(env.mossProjectId!, env.mossProjectKey!);
  const res = await client.responses.create(
    { instructions: system, input: prompt, max_output_tokens: maxTokens, retrieve: false },
    { timeout: 90_000 },
  );
  const usage = (res as unknown as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  return { text: res.output_text ?? "", inTok: usage?.input_tokens ?? 0, outTok: usage?.output_tokens ?? 0 };
}

// Rough per-token pricing used only for the telemetry display.
const USD_PER_INPUT_TOKEN = 3 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 15 / 1_000_000;

/**
 * Ask the LLM for JSON matching `schema`. In mock mode returns `mock()` (still validated),
 * so mock fixtures can never drift from the schema.
 */
export async function completeJson<S extends z.ZodTypeAny>(opts: {
  task: string;
  system: string;
  prompt: string;
  schema: S;
  mock: () => z.input<S>;
  maxTokens?: number;
}): Promise<LlmResult<z.infer<S>>> {
  if (!isLive("llm")) {
    const data = opts.schema.parse(opts.mock());
    const tokens = Math.round((opts.prompt.length + JSON.stringify(data).length) / 4);
    return { data, tokens, costUsd: 0, mode: "mock", provider: "mock" };
  }

  if (llmProvider() === "moss") {
    let r;
    try { r = await mossComplete(`${opts.system}\nRespond with a single JSON object only. No prose, no code fences.`, opts.prompt, opts.maxTokens ?? 4096); }
    catch (e) { throw new ApiError("VENDOR_ERROR", `Moss inference ${opts.task} failed: ${(e as Error).message}`, { vendor: "moss" }); }
    const parsed = opts.schema.safeParse(extractJson(r.text));
    if (!parsed.success) throw new ApiError("VENDOR_ERROR", `Moss inference ${opts.task} returned invalid JSON`, { issues: parsed.error.issues.slice(0, 5) });
    return { data: parsed.data, tokens: r.inTok + r.outTok, costUsd: 0, mode: "live", provider: "moss" };
  }

  const res = await vendorFetch("llm", "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.anthropicKey!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: env.anthropicModel,
      max_tokens: opts.maxTokens ?? 4096,
      system: `${opts.system}\nRespond with a single JSON object only. No prose, no code fences.`,
      messages: [{ role: "user", content: opts.prompt }],
    }),
  });
  if (!res.ok) throw new ApiError("VENDOR_ERROR", `LLM ${opts.task} failed: HTTP ${res.status}`, { vendor: "llm" });
  const body = (await res.json()) as { content: { type: string; text?: string }[]; usage?: { input_tokens: number; output_tokens: number } };
  const text = body.content.filter((c) => c.type === "text").map((c) => c.text).join("");
  const json = extractJson(text);
  const parsed = opts.schema.safeParse(json);
  if (!parsed.success) throw new ApiError("VENDOR_ERROR", `LLM ${opts.task} returned invalid JSON`, { issues: parsed.error.issues.slice(0, 5) });
  const inTok = body.usage?.input_tokens ?? 0;
  const outTok = body.usage?.output_tokens ?? 0;
  return { data: parsed.data, tokens: inTok + outTok, costUsd: inTok * USD_PER_INPUT_TOKEN + outTok * USD_PER_OUTPUT_TOKEN, mode: "live" };
}

export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new ApiError("VENDOR_ERROR", "LLM returned no JSON object");
  return JSON.parse(text.slice(start, end + 1));
}
