import { describe, it, expect } from "vitest";
import { validateCitations, normalizeUrl } from "@/lib/pipeline/citations";
import { fitScore, intentScore } from "@/lib/pipeline/scoring";
import { buildQueries, negativeReason, runDiscovery, MAX_QUERIES } from "@/lib/pipeline/discovery";
import { inferIcp } from "@/lib/pipeline/icp";
import { DEMO_ICP, DEMO_PRODUCT } from "@/lib/seed/fixtures";

describe("citation validator", () => {
  it("normalizes scheme, www, trailing slash, hash and utm params", () => {
    expect(normalizeUrl("https://www.A.example/x/?utm_source=t#h")).toBe(normalizeUrl("http://a.example/x"));
  });
  it("drops items with no returned URL and keeps only valid URLs", () => {
    const { kept, dropped } = validateCitations(
      [{ name: "ok", sourceUrls: ["https://a.example/1", "https://made-up.example"] }, { name: "bad", sourceUrls: ["https://nope.example"] }],
      ["https://a.example/1/"],
    );
    expect(kept.map((k) => k.name)).toEqual(["ok"]);
    expect(kept[0].sourceUrls).toEqual(["https://a.example/1/"]);
    expect(dropped[0].item.name).toBe("bad");
  });
});

describe("query building", () => {
  it("caps at 6 queries and puts accepted expansions first", () => {
    const qs = buildQueries(DEMO_ICP, [{ id: "e", segment: "Clinic roll-ups", rationale: "", evidence: [], status: "accepted" }]);
    expect(qs.length).toBeLessThanOrEqual(MAX_QUERIES);
    expect(qs[0]).toContain("Clinic roll-ups");
  });
});

describe("negative filter", () => {
  it("filters negative signals and excluded regions", () => {
    expect(negativeReason({ region: "United States", signals: [{ type: "negative", summary: "Hiring freeze" }] }, DEMO_ICP, [])).toMatch(/Hiring freeze/);
    expect(negativeReason({ region: "Germany", signals: [] }, DEMO_ICP, ["Germany"])).toMatch(/Excluded region/);
    expect(negativeReason({ region: "United States", signals: [{ type: "hiring", summary: "Hiring accountants" }] }, DEMO_ICP, [])).toBeNull();
  });
});

describe("fit and intent", () => {
  it("rewards ICP industry, size and region", () => {
    const good = fitScore(DEMO_ICP, { naics: "513210", industry: "", headcount: 600, region: "United States" });
    const bad = fitScore(DEMO_ICP, { naics: "111110", industry: "", headcount: 20, region: "Brazil" });
    expect(good).toBeGreaterThan(80);
    expect(bad).toBe(0);
  });
  it("counts each signal type once and ignores negative signals", () => {
    const now = new Date();
    const s = (type: "hiring" | "negative") => ({ type, summary: "x", detectedAt: now.toISOString() });
    expect(intentScore(DEMO_ICP, [s("hiring"), s("hiring")], now)).toBe(30);
    expect(intentScore(DEMO_ICP, [s("negative")], now)).toBe(0);
  });
});

describe("pipeline in mock mode", () => {
  it("infers an ICP with confidence and grounded expansions", async () => {
    const r = await inferIcp(DEMO_PRODUCT);
    expect(r.mode).toBe("mock");
    expect(r.icp.industries.every((i) => i.confidence >= 0 && i.confidence <= 1)).toBe(true);
    for (const e of r.expansions) expect(e.evidence.length).toBeGreaterThan(0);
  });

  it("discovery cites every company and signal, filters negatives, drops uncited", async () => {
    const out = await runDiscovery({ icp: DEMO_ICP, expansions: [], product: DEMO_PRODUCT });
    expect(out.companies.length).toBeGreaterThan(3);
    for (const c of out.companies) expect(out.citations.some((x) => x.entityId === c.id)).toBe(true);
    for (const s of out.signals) expect(out.citations.some((x) => x.entityId === s.id && x.url === s.sourceUrl)).toBe(true);
    expect(out.companies.find((c) => c.name === "Marlow Freight")?.excluded).toBe(true);
    expect(out.dropped.map((d) => d.name)).toContain("Phantom Ledger Co");
    expect(out.competitors.length).toBeGreaterThan(0);
    expect(new Set(out.companies.map((c) => c.domain)).size).toBe(out.companies.length);
  });
});
