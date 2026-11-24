import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { z } from "zod";
import { env } from "@/lib/env";
import { completeJson, extractJson, llmProvider, llmProviders } from "@/lib/providers/llm";

const schema = z.object({ name: z.string(), score: z.number() });
const mock = () => ({ name: "mock", score: 0 });
const KEYS = ["llamaKey", "anthropicKey", "mossProjectId", "mossProjectKey"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, env[k]]));
const chat = (content: string, status = 200) => new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status });

beforeEach(() => { Object.assign(env, { llamaKey: "test-llama", anthropicKey: undefined, mossProjectId: undefined, mossProjectKey: undefined }); });
afterEach(() => { Object.assign(env, saved); vi.unstubAllGlobals(); });

describe("Llama provider", () => {
  it("is the default when its key is set, ahead of Moss and Claude", () => {
    Object.assign(env, { anthropicKey: "a", mossProjectId: "m", mossProjectKey: "k" });
    expect(llmProviders()).toEqual(["llama", "moss", "anthropic"]);
    expect(llmProvider()).toBe("llama");
  });

  it("calls the OpenAI-compatible endpoint with JSON mode and parses the reply", async () => {
    const fetch = vi.fn(async () => chat('{"name":"Ledgerlight","score":0.9}'));
    vi.stubGlobal("fetch", fetch);
    const r = await completeJson({ task: "t", system: "s", prompt: "p", schema, mock });
    expect(r).toMatchObject({ data: { name: "Ledgerlight", score: 0.9 }, provider: "llama", mode: "live", tokens: 15, costUsd: 0 });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.llama.com/compat/v1/chat/completions");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(env.llamaModel);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-llama");
  });

  it("drops JSON mode when the endpoint rejects it", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response("bad response_format", { status: 400 })).mockResolvedValueOnce(chat('{"name":"x","score":1}'));
    vi.stubGlobal("fetch", fetch);
    const r = await completeJson({ task: "t", system: "s", prompt: "p", schema, mock });
    expect(r.data.name).toBe("x");
    expect(JSON.parse(String((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body)).response_format).toBeUndefined();
  });

  it("repairs invalid output with one retry", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(chat('{"name":"x"}')).mockResolvedValueOnce(chat('```json\n{"name":"x","score":2,}\n```'));
    vi.stubGlobal("fetch", fetch);
    const r = await completeJson({ task: "t", system: "s", prompt: "p", schema, mock });
    expect(r.data).toEqual({ name: "x", score: 2 });
    expect(JSON.parse(String((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body)).messages[1].content).toMatch(/score/);
  });

  it("falls back to Claude when Llama fails", async () => {
    env.anthropicKey = "a";
    const fetch = vi.fn(async (url: string) => url.includes("anthropic")
      ? new Response(JSON.stringify({ content: [{ type: "text", text: '{"name":"c","score":3}' }], usage: { input_tokens: 1, output_tokens: 1 } }))
      : new Response("down", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    const r = await completeJson({ task: "t", system: "s", prompt: "p", schema, mock });
    expect(r).toMatchObject({ provider: "anthropic", data: { name: "c" } });
  });

  it("names every provider when all fail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    await expect(completeJson({ task: "icp", system: "s", prompt: "p", schema, mock })).rejects.toThrow(/llama: HTTP 503/);
  });
});

describe("extractJson", () => {
  it("handles fences, prose and trailing commas", () => {
    expect(extractJson('Sure! ```json\n{"a":[1,2,],}\n``` done')).toEqual({ a: [1, 2] });
    expect(extractJson('Here: {"a":1} thanks')).toEqual({ a: 1 });
    expect(() => extractJson("no json")).toThrow();
  });
});
