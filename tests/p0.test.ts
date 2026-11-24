import { describe, it, expect, beforeEach } from "vitest";
import { buildDemoWorkspace } from "@/lib/seed/demo";
import { combineScore, tierFor } from "@/lib/pipeline/scoring";
import { formatHandoff, parseHandoff } from "@/lib/providers/band";

beforeEach(() => {
  for (const k of ["ANTHROPIC_API_KEY", "TAVILY_API_KEY", "HUNTER_API_KEY", "APOLLO_API_KEY", "SENDGRID_API_KEY", "FLEXPRICE_API_KEY"]) delete process.env[k];
});

describe("demo workspace invariants", () => {
  const ws = buildDemoWorkspace(new Date("2026-11-24T12:00:00Z"));

  it("every company and signal has at least one citation", () => {
    for (const c of ws.companies) expect(ws.citations.some((x) => x.entityId === c.id)).toBe(true);
    for (const s of ws.signals) expect(ws.citations.some((x) => x.entityId === s.id && x.url === s.sourceUrl)).toBe(true);
  });

  it("filtered companies never get a lead", () => {
    const excluded = new Set(ws.companies.filter((c) => c.excluded).map((c) => c.id));
    expect(excluded.size).toBeGreaterThan(0);
    for (const l of ws.leads) expect(excluded.has(l.companyId)).toBe(false);
  });

  it("every enriched field records its source", () => {
    for (const p of ws.people) {
      if (p.email) expect(p.emailSource).not.toBeNull();
      if (p.linkedinUrl) expect(p.linkedinSource).not.toBeNull();
    }
    for (const c of ws.companies) if (c.hq) expect(c.hqSource).not.toBeNull();
  });

  it("nothing is sent in the seed and drafts await approval", () => {
    expect(ws.messages.every((m) => m.status !== "sent" && m.sentAt === null)).toBe(true);
    expect(ws.messages.some((m) => m.status === "pending_approval")).toBe(true);
  });

  it("touch-1 messages cite a real signal", () => {
    const ids = new Set(ws.signals.map((s) => s.id));
    for (const m of ws.messages.filter((m) => m.step === 1)) {
      expect(m.signalIds.length).toBeGreaterThan(0);
      for (const id of m.signalIds) expect(ids.has(id)).toBe(true);
    }
  });
});

describe("scoring", () => {
  it("combines fit and intent and assigns tiers", () => {
    expect(combineScore(100, 100)).toBe(100);
    expect(tierFor(75)).toBe("A");
    expect(tierFor(74)).toBe("B");
    expect(tierFor(54)).toBe("C");
  });
});

describe("band handoff protocol", () => {
  it("round-trips a handoff line", () => {
    const line = formatHandoff({ to: "builder", verb: "TASK", args: { icp: "v3", max_queries: "6" }, rest: "discover" });
    const h = parseHandoff(line)!;
    expect(h.to).toBe("builder");
    expect(h.verb).toBe("TASK");
    expect(h.args).toEqual({ icp: "v3", max_queries: "6" });
  });
});

describe("mock providers", () => {
  it("hunter misses fall back to apollo in fixtures", async () => {
    const hunter = await import("@/lib/providers/hunter");
    const apollo = await import("@/lib/providers/apollo");
    const h = await hunter.findAndVerifyEmail("brightpath-logistics.example", "Dana", "Ortiz");
    expect(h.email).toBeNull();
    const a = await apollo.matchPerson({ firstName: "Dana", lastName: "Ortiz", domain: "brightpath-logistics.example" });
    expect(a.email).toBe("dana.ortiz@brightpath-logistics.example");
    expect(a.source).toBe("mock");
  });

  it("sendgrid never sends in mock mode and redirects to the demo inbox", async () => {
    const sg = await import("@/lib/providers/sendgrid");
    const r = await sg.sendEmail({ to: "priya@northwind-analytics.example", subject: "x", body: "y" });
    expect(r.simulated).toBe(true);
    expect(r.to).not.toBe("priya@northwind-analytics.example");
  });
});
