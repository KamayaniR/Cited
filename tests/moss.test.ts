import { describe, it, expect, beforeEach } from "vitest";
import { indexEvidence, searchEvidence, resetMockIndex } from "@/lib/providers/moss";
import { claimCheck, sentences, isSpecificClaim, hardFacts, evidenceDocs, matchTriggers } from "@/lib/pipeline/evidence";
import { buildDemoWorkspace } from "@/lib/seed/demo";
import { buildSequence } from "@/lib/pipeline/outreach";

beforeEach(async () => {
  resetMockIndex();
  await indexEvidence(evidenceDocs(buildDemoWorkspace()));
});

describe("Moss evidence memory (mock engine)", () => {
  it("indexes citations, signals, firmographics and the product", () => {
    const docs = evidenceDocs(buildDemoWorkspace());
    const types = new Set(docs.map((d) => d.metadata.entityType));
    for (const t of ["signal", "company", "competitor", "firmographics", "product"]) expect(types.has(t)).toBe(true);
  });

  it("scopes search to one company and returns timing", async () => {
    const r = await searchEvidence("did they change ERP?", { companyId: "co_brightpath", topK: 3 });
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.every((h) => h.metadata.companyId === "co_brightpath")).toBe(true);
    expect(r.hits[0].text).toMatch(/NetSuite/);
    expect(r.ms).toBeGreaterThanOrEqual(0);
  });
});

describe("claim check", () => {
  const ctx = { companyId: "co_northwind", companyName: "Northwind Analytics", productName: "Ledgerlight" };
  it("skips greetings, questions and generic lines", () => {
    const s = sentences("Hi Priya,\n\nHappy to connect and chat.\n\nWorth a look next week?");
    expect(s.filter((x) => isSpecificClaim(x, ["Northwind Analytics"]))).toEqual([]);
  });
  it("supports claims backed by evidence and flags invented ones", async () => {
    const ok = await claimCheck("I saw Northwind Analytics is hiring 3 finance data engineers.", ctx);
    expect(ok.unsupported).toEqual([]);
    const bad = await claimCheck("Congrats on Northwind Analytics' IPO on the Nasdaq last week.", ctx);
    expect(bad.unsupported.length).toBe(1);
  });
  it("flags a wrong funding round or amount even when the evidence is similar", async () => {
    expect((await claimCheck("Congrats on closing your Series D.", ctx)).unsupported.length).toBe(1);
    expect((await claimCheck("Congrats on Northwind Analytics' $60M Series C.", ctx)).unsupported.length).toBe(1);
    expect((await claimCheck("Congrats on Northwind Analytics' $45M Series C.", ctx)).unsupported).toEqual([]);
    expect(hardFacts("Raised $45 million in a Series C in 2025, up 30%")).toEqual(["series c", "$45m", "30%", "2025"]);
  });
  it("accepts claims about our own product", async () => {
    const r = await claimCheck("Ledgerlight reconciles bank feeds and drafts journal entries inside NetSuite.", ctx);
    expect(r.unsupported).toEqual([]);
  });
});

describe("semantic trigger matching", () => {
  it("matches signals to ICP triggers by meaning", async () => {
    const r = await matchTriggers(["ERP migration to NetSuite or Sage Intacct", "New CFO in the last 6 months"]);
    expect(r.matches.has("sig_brightpath_0")).toBe(true);
    expect(r.matches.has("sig_brightpath_1")).toBe(true);
  });
});

describe("grounded drafting", () => {
  it("drafts pass the claim check and carry grounding", async () => {
    const ws = buildDemoWorkspace();
    ws.messages = [];
    const lead = ws.leads.find((l) => l.companyId === "co_northwind")!;
    const r = await buildSequence(ws, lead);
    expect(r.evidence.count).toBeGreaterThan(0);
    const t1 = r.messages.find((m) => m.step === 1)!;
    expect(t1.status).toBe("pending_approval");
    expect(t1.review?.grounding?.claims.length).toBeGreaterThan(0);
    expect(t1.review?.grounding?.claims.every((c) => c.supported)).toBe(true);
  });
});
