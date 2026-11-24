import "server-only";
import { vendorFetch } from "@/lib/monitor";
import type { z } from "zod";
import { env, isLive, mockFor } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";

export type LlmProvider = "llama" | "moss" | "anthropic";
export interface LlmResult<T> { data: T; tokens: number; costUsd: number; mode: "live" | "mock"; provider?: LlmProvider | "mock" }

/** Providers with keys, in the order they are tried: Meta Llama, then Moss Inference, then Claude. */
export function llmProviders(): LlmProvider[] {
  const out: LlmProvider[] = [];
  if (env.llamaKey) out.push("llama");
  if (env.mossProjectId && env.mossProjectKey) out.push("moss");
  if (env.anthropicKey) out.push("anthropic");
  return out;
}

/** The provider that runs first, or "mock" when none has a key. */
export function llmProvider(): LlmProvider | "mock" {
  if (!isLive("llm")) return "mock";
  return llmProviders()[0] ?? "mock";
}

interface Completion { text: string; inTok: number; outTok: number }

const JSON_RULE = "Respond with a single JSON object only. No prose, no markdown, no code fences.";

/** Meta Llama API (OpenAI-compatible chat completions). Asks for JSON mode and drops it if the endpoint rejects it. */
async function llamaComplete(system: string, prompt: string, maxTokens: number): Promise<Completion> {
  const url = `${env.llamaBaseUrl.replace(/\/$/, "")}/chat/completions`;
  const call = (jsonMode: boolean) => vendorFetch("llm", url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.llamaKey}` },
    body: JSON.stringify({
      model: env.llamaModel,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  let res = await call(true);
  if (res.status === 400 || res.status === 422) res = await call(false);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const body = (await res.json()) as {
    choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[];
    completion_message?: { content?: { text?: string } | string };
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const c = body.choices?.[0]?.message?.content ?? body.completion_message?.content;
  const text = typeof c === "string" ? c : Array.isArray(c) ? c.map((p) => p.text ?? "").join("") : (c?.text ?? "");
  return { text, inTok: body.usage?.prompt_tokens ?? 0, outTok: body.usage?.completion_tokens ?? 0 };
}

async function mossComplete(system: string, prompt: string, maxTokens: number): Promise<Completion> {
  const { MossInference } = await import("@moss-js/moss");
  const client = new MossInference(env.mossProjectId!, env.mossProjectKey!);
  const res = await client.responses.create(
    { instructions: system, input: prompt, max_output_tokens: maxTokens, retrieve: false },
    { timeout: 90_000 },
  );
  const usage = (res as unknown as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  return { text: res.output_text ?? "", inTok: usage?.input_tokens ?? 0, outTok: usage?.output_tokens ?? 0 };
}

async function anthropicComplete(system: string, prompt: string, maxTokens: number): Promise<Completion> {
  const res = await vendorFetch("llm", "https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.anthropicKey!, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: env.anthropicModel, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { content: { type: string; text?: string }[]; usage?: { input_tokens: number; output_tokens: number } };
  return { text: body.content.filter((c) => c.type === "text").map((c) => c.text).join(""), inTok: body.usage?.input_tokens ?? 0, outTok: body.usage?.output_tokens ?? 0 };
}

const COMPLETE: Record<LlmProvider, (s: string, p: string, m: number) => Promise<Completion>> = { llama: llamaComplete, moss: mossComplete, anthropic: anthropicComplete };

// Rough per-token pricing used only for the telemetry display. Llama and Moss run on prepaid credits, shown as $0.
const USD_PER_INPUT_TOKEN = 3 / 1_000_000;
const USD_PER_OUTPUT_TOKEN = 15 / 1_000_000;
const cost = (p: LlmProvider, c: Completion) => (p === "anthropic" ? c.inTok * USD_PER_INPUT_TOKEN + c.outTok * USD_PER_OUTPUT_TOKEN : 0);

/**
 * Ask the LLM for JSON matching `schema`. Tries Llama, then Moss, then Claude, skipping any without a key.
 * Each provider gets one repair retry when its output is not valid JSON for the schema.
 * In mock mode returns `mock()` (still validated), so mock fixtures can never drift from the schema.
 */
export async function completeJson<S extends z.ZodTypeAny>(opts: {
  task: string;
  system: string;
  prompt: string;
  schema: S;
  mock: () => z.input<S>;
  maxTokens?: number;
}): Promise<LlmResult<z.infer<S>>> {
  if (mockFor("llm")) {
    const data = opts.schema.parse(opts.mock());
    const tokens = Math.round((opts.prompt.length + JSON.stringify(data).length) / 4);
    return { data, tokens, costUsd: 0, mode: "mock", provider: "mock" };
  }

  const system = `${opts.system}\n${JSON_RULE}`;
  const maxTokens = opts.maxTokens ?? 4096;
  const failures: string[] = [];
  for (const provider of llmProviders()) {
    let tokens = 0, costUsd = 0;
    try {
      let prompt = opts.prompt;
      for (let attempt = 0; attempt < 2; attempt++) {
        const r = await COMPLETE[provider](system, prompt, maxTokens);
        tokens += r.inTok + r.outTok; costUsd += cost(provider, r);
        let problem: string;
        try {
          const parsed = opts.schema.safeParse(extractJson(r.text));
          if (parsed.success) return { data: parsed.data, tokens, costUsd, mode: "live", provider };
          problem = parsed.error.issues.slice(0, 8).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
        } catch (e) { problem = (e as Error).message; }
        prompt = `${opts.prompt}\n\nYour previous answer was not valid for the required JSON shape (${problem}).\nPrevious answer:\n${r.text.slice(0, 6000)}\n\nReturn the corrected JSON object only.`;
        if (attempt === 1) throw new Error(`invalid JSON: ${problem}`);
      }
    } catch (e) {
      failures.push(`${provider}: ${(e as Error).message}`);
    }
  }
  throw new ApiError("VENDOR_ERROR", `LLM ${opts.task} failed (${failures.join(" | ") || "no provider"})`, { vendor: "llm" });
}

/** Pull a JSON object out of model text: strips code fences and prose, tolerates trailing commas. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ApiError("VENDOR_ERROR", "LLM returned no JSON object");
  const raw = src.slice(start, end + 1);
  try { return JSON.parse(raw); }
  catch { return JSON.parse(raw.replace(/,\s*([}\]])/g, "$1")); }
}
