import { describe, it, expect, afterEach } from "vitest";
import { mockFor, MissingKeyError, isLive } from "@/lib/env";
import { errorResponse } from "@/lib/api/errors";

// The live app shows real data only: a data vendor without its key is an error, never a mock.
describe("real-data mode", () => {
  const saved = process.env.VITEST;
  afterEach(() => { process.env.VITEST = saved; delete process.env.CITED_ALLOW_MOCK; });

  it("throws for a data vendor with no key outside tests", () => {
    delete process.env.VITEST;
    expect(isLive("tavily")).toBe(false);
    expect(() => mockFor("tavily")).toThrow(MissingKeyError);
    expect(() => mockFor("llm")).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("keeps local fallbacks for infrastructure vendors", () => {
    delete process.env.VITEST;
    expect(mockFor("flexprice")).toBe(true);
    expect(mockFor("neo4j")).toBe(true);
  });

  it("allows mocks only when explicitly allowed", () => {
    delete process.env.VITEST;
    process.env.CITED_ALLOW_MOCK = "true";
    expect(mockFor("hunter")).toBe(true);
  });

  it("returns a clear 503 naming the missing key", async () => {
    const res = errorResponse(new MissingKeyError("hunter"));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.message).toMatch(/HUNTER_API_KEY/);
    expect(body.error.details.missingKey).toBe(true);
  });
});
