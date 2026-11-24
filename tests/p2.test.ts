import { describe, it, expect } from "vitest";
import { enrichCompany, pickBuyer, applyEnrichment, enrichQueue } from "@/lib/pipeline/enrich";
import { buildSequence } from "@/lib/pipeline/outreach";
import { reviewMessage } from "@/lib/agents/reviewer";
import { securityCheck } from "@/lib/agents/security";
import { markSent, assertReviewable, findMessage } from "@/lib/pipeline/review";
import { requireCredits, charge } from "@/lib/pipeline/credits";
import { runDiscovery } from "@/lib/pipeline/discovery";
import { emptyWorkspace } from "@/lib/db/store";
import { DEMO_ICP, DEMO_PRODUCT } from "@/lib/seed/fixtures";
import type { Company, Workspace } from "@/lib/types";
import { syncEvidence } from "@/lib/pipeline/evidence";
import { resetMockIndex } from "@/lib/providers/moss";

const co = (domain: string, name = domain): Company => ({ id: `co_${domain}`, name, domain, domainSource: "tavily", industry: "x", naics: "513210", headcount: 500, region: "United States", hq: null, hqSource: null, fitScore: 80, intentScore: 80, score: 80, tier: "A", excluded: false, excludeReason: null, signalsRefreshedAt: "" });

describe("enrichment fallback", () => {
  it("uses Apollo only for what Hunter misses and records the source", async () => {
    const r = await enrichCompany(DEMO_ICP, co("brightpath-logistics.example"));
    expect(r.hq).toBe("Columbus, Ohio, United States");
    expect(r.hqSource).toBe("apollo");
    expect(r.person?.email).toBe("dana.ortiz@brightpath-logistics.example");
    expect(r.person?.emailSource).toBe("apollo");
    expect(r.person?.linkedinSource).toBe("apollo");
  });
  it("keeps Hunter values when present", async () => {
    const r = await enrichCompany(DEMO_ICP, co("northwind-analytics.example"));
    expect(r.hqSource).toBe("hunter");
    expect(r.person?.name).toBe("Priya Natarajan");
    expect(r.person?.emailSource).toBe("hunter");
    expect(r.calls.apollo).toBe(0);
  });
  it("never keeps an invalid email", async () => {
    const r = await enrichCompany(DEMO_ICP, co("tessellate-retail.example"));
    expect(r.person?.email).toBeNull();
    expect(r.person?.emailSource).toBeNull();
    expect(r.person?.linkedinUrl).not.toBeNull();
  });
  it("picks the persona-matching buyer", () => {
    const p = pickBuyer(DEMO_ICP, [
      { firstName: "A", lastName: "B", position: "Software Engineer", seniority: "senior" },
      { firstName: "C", lastName: "D", position: "Corporate Controller", seniority: "director" },
    ]);
    expect(p?.contact.firstName).toBe("C");
  });
});

describe("reviewer and security", () => {
  const ctx = { seniority: "c_level", signalIds: new Set(["sig_1"]) };
  it("flags missing signal, length, dashes, buzzwords and extra CTAs", () => {
    const long = Array(90).fill("word").join(" ");
    const fixes = reviewMessage({ id: "m", step: 1, channel: "email", subject: "s", body: `${long} — synergy? really?`, signalIds: [] }, ctx);
    expect(fixes.join(" ")).toMatch(/cites no signal/);
    expect(fixes.join(" ")).toMatch(/limit 80/);
    expect(fixes.join(" ")).toMatch(/dash/);
    expect(fixes.join(" ")).toMatch(/synergy/);
    expect(fixes.join(" ")).toMatch(/one CTA/);
  });
  it("passes a clean message", () => {
    expect(reviewMessage({ id: "m", step: 1, channel: "email", subject: "s", body: "Hi, saw the hiring news. Worth a chat?", signalIds: ["sig_1"] }, ctx)).toEqual([]);
  });
  it("blocks uncited links, emails and secrets", () => {
    const b = securityCheck({ id: "m", subject: null, body: "See https://evil.com and mail bob@x.com sk-ant-abcdefghijklmnopqrst" }, { citedDomains: new Set(["good.example"]), ownDomains: new Set() });
    expect(b.length).toBe(3);
  });
});

async function pipelineWs(): Promise<Workspace> {
  const ws = emptyWorkspace();
  ws.product = { id: "p", ...DEMO_PRODUCT };
  ws.icp = { id: "i", version: 1, data: DEMO_ICP, approvedAt: "x" };
  const d = await runDiscovery({ icp: DEMO_ICP, expansions: [], product: DEMO_PRODUCT });
  Object.assign(ws, { companies: d.companies, signals: d.signals, citations: d.citations });
  for (const c of enrichQueue(ws)) {
    const r = await enrichCompany(DEMO_ICP, c);
    const lead = applyEnrichment(ws, c, r);
    if (lead) charge(ws, "lead_enriched", lead.id);
  }
  resetMockIndex();
  await syncEvidence(ws);
  return ws;
}

describe("outreach loop in mock mode", () => {
  it("drafts 3 touches that pass review, with touch 1 citing a real signal", async () => {
    const ws = await pipelineWs();
    expect(ws.leads.length).toBeGreaterThan(3);
    const lead = ws.leads.find((l) => ws.companies.find((c) => c.id === l.companyId)?.name === "Northwind Analytics")!;
    const r = await buildSequence(ws, lead);
    expect(r.messages.map((m) => m.channel)).toEqual(["email", "linkedin", "email"]);
    expect(r.messages.every((m) => m.status === "pending_approval")).toBe(true);
    const t1 = r.messages.find((m) => m.step === 1)!;
    expect(t1.signalIds.length).toBe(1);
    expect(ws.signals.some((s) => s.id === t1.signalIds[0])).toBe(true);
    expect(r.messages.every((m) => !/[—–]/.test(m.body))).toBe(true);
  });

  it("skips email touches when the email is unknown", async () => {
    const ws = await pipelineWs();
    const lead = ws.leads.find((l) => ws.companies.find((c) => c.id === l.companyId)?.name === "Tessellate Retail Group")!;
    const r = await buildSequence(ws, lead);
    expect(r.messages.every((m) => m.channel === "linkedin")).toBe(true);
  });

  it("first send moves the lead to Contacted with the right actor; sent messages can't be re-approved", async () => {
    const ws = await pipelineWs();
    const lead = ws.leads[0];
    const r = await buildSequence(ws, lead);
    ws.messages.push(...r.messages);
    const li = r.messages.find((m) => m.channel === "linkedin")!;
    li.status = "approved";
    markSent(ws, li, lead, { deliveredTo: "manual:linkedin", actor: "rep", detail: "" });
    expect(lead.stage).toBe("contacted");
    expect(lead.owner).toBe("rep");
    expect(li.sentAt).not.toBeNull();
    expect(() => assertReviewable(findMessage(ws, li.id).message)).toThrow(/already sent/);
    expect(ws.auditLog[0].actor).toBe("rep");
  });
});

describe("credit gate", () => {
  it("blocks when the balance can't cover the event", () => {
    const ws = emptyWorkspace();
    ws.org.creditsBalance = 1;
    expect(() => requireCredits(ws, "lead_enriched")).toThrow(/Need 2 credits, balance 1/);
    ws.org.creditsBalance = 2;
    charge(ws, "lead_enriched", null);
    expect(ws.org.creditsBalance).toBe(0);
    expect(ws.usageEvents[0].credits).toBe(2);
  });
});
