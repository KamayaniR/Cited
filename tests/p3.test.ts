import { describe, it, expect, beforeEach } from "vitest";
import { buildDemoWorkspace } from "@/lib/seed/demo";
import { funnel, reachedStages } from "@/lib/pipeline/analytics";
import { replaceWorkspace, getWorkspace } from "@/lib/db/store";
import { PATCH as stagePatch } from "@/app/api/leads/[id]/stage/route";
import { GET as analyticsGet } from "@/app/api/analytics/route";

process.env.VERCEL = "1"; // keep the store in memory during tests

const patch = (id: string, body: unknown) =>
  stagePatch(new Request(`http://t/api/leads/${id}/stage`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => replaceWorkspace(buildDemoWorkspace(new Date("2026-11-24T12:00:00Z"))));

describe("seeded pipeline", () => {
  it("has leads in every stage with won and lost closes", () => {
    const ws = getWorkspace();
    for (const s of ["matched", "contacted", "replied", "meeting_booked", "closed_lost"]) expect(ws.leads.some((l) => l.stage === s)).toBe(true);
    const closed = ws.leads.filter((l) => l.stage === "closed_lost");
    expect(closed.map((l) => l.outcome).sort()).toEqual(["lost", "won"]);
    expect(closed.every((l) => l.closeReason)).toBe(true);
  });

  it("every lead's events form a continuous chain ending at its current stage", () => {
    const ws = getWorkspace();
    for (const l of ws.leads) {
      const ev = ws.leadEvents.filter((e) => e.leadId === l.id).sort((a, b) => a.at.localeCompare(b.at));
      expect(ev[0].fromStage).toBeNull();
      for (let i = 1; i < ev.length; i++) expect(ev[i].fromStage).toBe(ev[i - 1].toStage);
      expect(ev.at(-1)!.toStage).toBe(l.stage);
    }
  });
});

describe("stage moves", () => {
  it("moves a card, attributes it to the rep and writes the audit log", async () => {
    const lead = getWorkspace().leads.find((l) => l.stage === "contacted")!;
    const res = await patch(lead.id, { stage: "replied" });
    expect(res.status).toBe(200);
    const ws = getWorkspace();
    const l = ws.leads.find((x) => x.id === lead.id)!;
    expect(l.stage).toBe("replied");
    expect(l.owner).toBe("rep");
    expect(ws.leadEvents.at(-1)).toMatchObject({ leadId: lead.id, fromStage: "contacted", toStage: "replied", actor: "rep" });
    expect(ws.auditLog[0]).toMatchObject({ actor: "rep", action: "stage_changed", target: lead.id });
  });

  it("rejects Closed/Lost without an outcome, and records outcome and reason when given", async () => {
    const lead = getWorkspace().leads.find((l) => l.stage === "meeting_booked")!;
    const bad = await patch(lead.id, { stage: "closed_lost" });
    expect(bad.status).toBe(400);
    expect((await bad.json()).error.code).toBe("VALIDATION_ERROR");
    expect(getWorkspace().leads.find((l) => l.id === lead.id)!.stage).toBe("meeting_booked");

    const ok = await patch(lead.id, { stage: "closed_lost", outcome: "won", note: "Signed annual" });
    expect(ok.status).toBe(200);
    const l = getWorkspace().leads.find((x) => x.id === lead.id)!;
    expect(l).toMatchObject({ stage: "closed_lost", outcome: "won", closeReason: "Signed annual", owner: "rep" });
  });

  it("reopening a closed lead clears its outcome", async () => {
    const lead = getWorkspace().leads.find((l) => l.outcome === "lost")!;
    await patch(lead.id, { stage: "replied" });
    const l = getWorkspace().leads.find((x) => x.id === lead.id)!;
    expect(l.outcome).toBeNull();
    expect(l.closeReason).toBeNull();
  });

  it("404s an unknown lead and 400s an unknown stage", async () => {
    expect((await patch("lead_nope", { stage: "replied" })).status).toBe(404);
    const lead = getWorkspace().leads[0];
    expect((await patch(lead.id, { stage: "won" })).status).toBe(400);
  });
});

describe("analytics", () => {
  it("counts reached stages from history, so skipped stages still count", () => {
    const ws = getWorkspace();
    const lead = ws.leads.find((l) => l.stage === "matched")!;
    ws.leadEvents.push({ id: "x", leadId: lead.id, fromStage: "matched", toStage: "meeting_booked", actor: "rep", note: "", at: "2026-11-24T12:00:00Z" });
    lead.stage = "meeting_booked";
    expect([...reachedStages(ws, lead)].sort()).toEqual(["contacted", "matched", "meeting_booked", "replied"]);
  });

  it("computes the seeded funnel and rates", () => {
    const [all] = funnel(getWorkspace());
    expect(all.leads).toBe(6);
    expect(all.reached.contacted).toBe(5);
    expect(all.reached.replied).toBe(4);
    expect(all.reached.meeting_booked).toBe(2);
    expect(all).toMatchObject({ won: 1, lost: 1, winRate: 0.5, replyRate: 0.8, meetingRate: 0.4 });
  });

  it("groups by variant, tier and industry and the API validates groupBy", async () => {
    const ws = getWorkspace();
    const byVariant = funnel(ws, "variant");
    expect(byVariant.map((r) => r.group).sort()).toEqual(["Variant A", "Variant B"]);
    expect(byVariant.reduce((s, r) => s + r.leads, 0)).toBe(ws.leads.length);
    expect(funnel(ws, "tier").every((r) => r.group.startsWith("Tier "))).toBe(true);
    expect(funnel(ws, "industry").length).toBe(6);
    const res = await analyticsGet(new Request("http://t/api/analytics?groupBy=tier"));
    expect((await res.json()).rows.length).toBeGreaterThan(0);
    expect((await analyticsGet(new Request("http://t/api/analytics?groupBy=nope"))).status).toBe(400);
  });
});
