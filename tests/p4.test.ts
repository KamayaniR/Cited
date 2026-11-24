import { describe, it, expect, beforeEach } from "vitest";
import { buildDemoWorkspace } from "@/lib/seed/demo";
import { replaceWorkspace, getWorkspace } from "@/lib/db/store";
import { buildGraph, graphStats, orgKey } from "@/lib/graph/model";
import { queryMemory, CYPHER, type WarmRow, type HiringRow, type DisplacementRow } from "@/lib/graph/queries";
import { refreshSignals, refreshQueue } from "@/lib/pipeline/refresh";
import { parseTeamHeuristic } from "@/lib/pipeline/team";
import { MOCK_REFRESH_SIGNALS, DEMO_PRODUCT } from "@/lib/seed/fixtures";
import { resetMockIndex } from "@/lib/providers/moss";
import { syncEvidence } from "@/lib/pipeline/evidence";
import { GET as graphQuery } from "@/app/api/graph/query/route";
import { GET as cron } from "@/app/api/cron/refresh/route";

process.env.VERCEL = "1";

beforeEach(async () => {
  const ws = buildDemoWorkspace(new Date());
  replaceWorkspace(ws);
  resetMockIndex();
  await syncEvidence(ws);
});

describe("graph model", () => {
  it("has every spec node and edge type, with ids matching the records", () => {
    const ws = getWorkspace();
    const g = buildGraph(ws);
    const s = graphStats(g);
    for (const l of ["Company", "Person", "Product", "Competitor", "Signal", "Team", "School"]) expect(s.nodes[l]).toBeGreaterThan(0);
    for (const e of ["works_at", "competes_with", "matched_to", "contacted_via", "replied_to", "previously_employed_at", "has_signal", "uses", "studied_at"]) expect(s.edges[e]).toBeGreaterThan(0);
    for (const c of ws.companies) expect(g.nodes.get(c.id)?.label).toBe("Company");
    for (const e of g.edges) { expect(g.nodes.has(e.from)).toBe(true); expect(g.nodes.has(e.to)).toBe(true); }
  });

  it("treats spelling variants of an employer as one node", () => {
    expect(orgKey("Stratus Data, Inc.")).toBe(orgKey("Stratus Data"));
  });
});

describe("multi-hop queries (memory engine)", () => {
  it("warm path: co-founder and the Northwind buyer both worked at Stratus Data", () => {
    const rows = queryMemory(getWorkspace(), "warm") as WarmRow[];
    expect(rows[0]).toMatchObject({ team: "Maya Chen", via: "Stratus Data", viaLabel: "Company", person: "Priya Natarajan", company: "Northwind Analytics", isBuyer: true });
    expect(rows.some((r) => r.viaLabel === "School" && r.via === "Carnegie Mellon" && r.person === "Grace Liu")).toBe(true);
  });

  it("hiring → evaluation pairs finance hiring with an evaluation trigger and names the buyer", () => {
    const rows = queryMemory(getWorkspace(), "hiring") as HiringRow[];
    const nw = rows.find((r) => r.company === "Northwind Analytics")!;
    expect(nw.hiring).toMatch(/finance data engineers/);
    expect(nw.evaluation.join(" ")).toMatch(/Series C/);
    expect(nw.buyer).toBe("Priya Natarajan");
    expect(rows.every((r) => r.evaluation.length > 0)).toBe(true);
  });

  it("displacement finds the FloQast customer with a renewal coming up, citing the signal", () => {
    const rows = queryMemory(getWorkspace(), "displacement") as DisplacementRow[];
    expect(rows[0]).toMatchObject({ company: "Corvid Robotics", competitor: "FloQast", renewal: true });
    expect(rows[0].evidenceUrl).toMatch(/^https:\/\/corvid-robotics\.example\//);
    expect(getWorkspace().signals.some((s) => s.sourceUrl === rows[0].evidenceUrl)).toBe(true);
  });

  it("excluded companies never appear", () => {
    const ws = getWorkspace();
    ws.companies.find((c) => c.name === "Northwind Analytics")!.excluded = true;
    for (const q of ["warm", "hiring", "displacement"] as const) expect((queryMemory(ws, q) as { company: string }[]).some((r) => r.company === "Northwind Analytics")).toBe(false);
  });

  it("the Cypher for each query is scoped to the org and filters excluded companies", () => {
    for (const c of Object.values(CYPHER)) { expect(c).toContain("$org"); expect(c).toContain("c.excluded = false"); }
  });

  it("the API charges 0.5 credits per query and returns 402 when out", async () => {
    const before = getWorkspace().org.creditsBalance;
    const res = await graphQuery(new Request("http://t/api/graph/query?q=warm"));
    const body = await res.json();
    expect(body.engine).toBe("memory");
    expect(body.rows.length).toBeGreaterThan(0);
    expect(getWorkspace().org.creditsBalance).toBe(before - 0.5);
    getWorkspace().org.creditsBalance = 0;
    expect((await graphQuery(new Request("http://t/api/graph/query?q=warm"))).status).toBe(402);
    expect((await graphQuery(new Request("http://t/api/graph/query?q=nope"))).status).toBe(400);
  });
});

describe("signal refresh", () => {
  it("queues Tier A/B only, oldest refresh first", () => {
    const q = refreshQueue(getWorkspace());
    expect(q.every((c) => c.tier !== "C" && !c.excluded)).toBe(true);
  });

  it("re-tiers Halcyon from B to A on a new funding signal, cited and audited", async () => {
    const before = getWorkspace().companies.find((c) => c.name === "Halcyon Health Partners")!;
    expect(before.tier).toBe("B");
    const r = await refreshSignals({ actor: "agent", trigger: "cron" });
    const ws = getWorkspace();
    const h = ws.companies.find((c) => c.id === before.id)!;
    expect(h.tier).toBe("A");
    expect(r.tierChanges).toContainEqual(expect.objectContaining({ companyId: h.id, from: "B", to: "A" }));
    const sig = ws.signals.find((s) => s.companyId === h.id && /growth round/.test(s.summary))!;
    expect(ws.citations.some((c) => c.entityId === sig.id && c.url === sig.sourceUrl)).toBe(true);
    expect(ws.auditLog.some((a) => a.action === "tier_changed" && a.target === h.id)).toBe(true);
    expect(ws.usageEvents.filter((u) => u.eventName === "signal_refresh").length).toBe(r.processed);
  });

  it("is idempotent: a second run adds nothing", async () => {
    await refreshSignals({ actor: "agent", trigger: "cron" });
    const r = await refreshSignals({ actor: "agent", trigger: "cron" });
    expect(r.added).toBe(0);
  });

  it("skips (doesn't fail) when out of credits", async () => {
    getWorkspace().org.creditsBalance = 0;
    const r = await refreshSignals({ actor: "agent", trigger: "cron" });
    expect(r.processed).toBe(0);
    expect(r.skippedForCredits).toBeGreaterThan(0);
  });

  it("a new negative signal filters the company and withdraws unsent drafts", async () => {
    const key = "northwind-analytics.example";
    MOCK_REFRESH_SIGNALS[key] = [{ type: "negative", summary: "Announced layoffs in finance", path: "/news/layoffs" }];
    try {
      const nw = getWorkspace().companies.find((c) => c.domain === key)!;
      const r = await refreshSignals({ companyIds: [nw.id], actor: "rep", trigger: "manual" });
      const ws = getWorkspace();
      expect(r.filtered).toEqual([nw.id]);
      expect(ws.companies.find((c) => c.id === nw.id)!.excluded).toBe(true);
      const lead = ws.leads.find((l) => l.companyId === nw.id)!;
      expect(ws.messages.filter((m) => m.leadId === lead.id).every((m) => m.status === "rejected" || m.status === "sent")).toBe(true);
      expect(ws.auditLog.some((a) => a.action === "lead_filtered" && a.target === lead.id)).toBe(true);
    } finally { delete MOCK_REFRESH_SIGNALS[key]; }
  });

  it("cron requires CRON_SECRET", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await cron(new Request("http://t/api/cron/refresh"))).status).toBe(401);
    const ok = await cron(new Request("http://t/api/cron/refresh", { headers: { authorization: "Bearer s3cret" } }));
    expect(ok.status).toBe(200);
    expect((await ok.json()).processed).toBeGreaterThan(0);
  });
});

describe("team parsing", () => {
  it("pulls past employers and schools from the intake's team background", () => {
    const { team } = parseTeamHeuristic(DEMO_PRODUCT.teamBackground);
    expect(team).toContainEqual(expect.objectContaining({ name: "Maya Chen", previouslyAt: ["Stratus Data"] }));
    expect(team).toContainEqual(expect.objectContaining({ role: "CTO", school: "Carnegie Mellon" }));
  });
});
