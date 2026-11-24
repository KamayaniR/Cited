import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import crypto from "crypto";
import { buildDemoWorkspace } from "@/lib/seed/demo";
import { replaceWorkspace, getWorkspace, agentEvent } from "@/lib/db/store";
import { resetMockIndex } from "@/lib/providers/moss";
import { syncEvidence } from "@/lib/pipeline/evidence";
import { decideBatch, decideSchema, proposeSchemaChange, isSafeSchemaChange } from "@/lib/pipeline/decide";
import { applyBandCommand, pollBand } from "@/lib/pipeline/bandDecisions";
import { parseCommand, mirrorEvent, participantFor, resetBandCache, verifyBandWebhook } from "@/lib/providers/band";
import { POST as approvalPost } from "@/app/api/approvals/[id]/route";

process.env.VERCEL = "1";

beforeEach(async () => {
  for (const k of ["BAND_API_KEY", "BAND_ROOM_ID", "SENDGRID_API_KEY"]) delete process.env[k];
  const ws = buildDemoWorkspace(new Date());
  replaceWorkspace(ws);
  resetMockIndex();
  await syncEvidence(ws);
  resetBandCache();
});
afterEach(() => { vi.unstubAllGlobals(); delete process.env.BAND_API_KEY; delete process.env.BAND_ROOM_ID; });

describe("Band command parsing", () => {
  it("reads approvals, exceptions, rejections, edits and schema decisions", () => {
    expect(parseCommand("@[[a1b2]] approve b_1")).toEqual({ kind: "approve_batch", target: "b_1", except: {} });
    expect(parseCommand("@Security approve b_1 except msg_nw_e2 (too long for a CFO)")).toEqual({ kind: "approve_batch", target: "b_1", except: { msg_nw_e2: "too long for a CFO" } });
    expect(parseCommand("reject msg_nw_e2 too long for a CFO")).toEqual({ kind: "reject_message", id: "msg_nw_e2", reason: "too long for a CFO" });
    expect(parseCommand("edit msg_nw_e1 subject: Quick question on the close")).toEqual({ kind: "edit_subject", id: "msg_nw_e1", subject: "Quick question on the close" });
    expect(parseCommand("reject apr_schema_1 not for the hackathon")).toEqual({ kind: "schema", id: "apr_schema_1", decision: "reject", reason: "not for the hackathon" });
    expect(parseCommand("looks good to me").kind).toBe("unknown");
  });
});

describe("one decision path for UI and Band", () => {
  it("approve batch except one: email sent to demo inbox, LinkedIn queued, one back to builder", async () => {
    const r = await applyBandCommand({ kind: "approve_batch", target: "b_1", except: { msg_nw_e2: "too long for a CFO" } }, { kind: "band", room: "room_1" });
    expect(r).toMatch(/2 approved, 1 rejected/);
    const ws = getWorkspace();
    const m = (id: string) => ws.messages.find((x) => x.id === id)!;
    expect(m("msg_nw_e1")).toMatchObject({ status: "sent", deliveredTo: "demo" });
    expect(m("msg_nw_l1").status).toBe("approved");
    expect(m("msg_nw_e2").status).toBe("rejected");
    expect(ws.leads.find((l) => l.id === m("msg_nw_e1").leadId)).toMatchObject({ stage: "contacted", owner: "agent" });
    expect(ws.approvals.find((a) => a.id === "apr_b1")).toMatchObject({ status: "approved", decidedVia: "band" });
    const rows = ws.auditLog.filter((a) => ["message_approved", "message_rejected", "batch_decided"].includes(a.action));
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(rows.every((a) => a.actor === "rep" && a.agent === "band:room_1")).toBe(true);
    expect(ws.auditLog.some((a) => a.action === "email_sent" && a.actor === "agent")).toBe(true);
    expect(ws.agentEvents.some((e) => e.fromRole === "security" && e.toRole === "builder" && /FIX.*msg_nw_e2: too long for a CFO/.test(e.text))).toBe(true);
  });

  it("the UI route writes the same rows with agent=ui", async () => {
    const res = await approvalPost(new Request("http://t", { method: "POST", body: JSON.stringify({ decision: "approve", reject: { msg_nw_e2: "too long" } }) }), { params: Promise.resolve({ id: "apr_b1" }) });
    expect(res.status).toBe(200);
    const ws = getWorkspace();
    expect(ws.approvals.find((a) => a.id === "apr_b1")).toMatchObject({ status: "approved", decidedVia: "ui" });
    expect(ws.auditLog.filter((a) => a.action === "message_approved").every((a) => a.agent === "ui")).toBe(true);
  });

  it("a decided batch can't be decided again", async () => {
    await decideBatch("apr_b1", { rejectAll: "no", via: { kind: "ui" } });
    expect(getWorkspace().approvals.find((a) => a.id === "apr_b1")!.status).toBe("rejected");
    await expect(decideBatch("apr_b1", { via: { kind: "ui" } })).rejects.toThrow(/already rejected/);
  });

  it("rejecting a schema change makes the planner re-plan; only safe DDL can be proposed", async () => {
    const a = await decideSchema("apr_schema_1", "reject", { note: "not now", via: { kind: "band", room: "r" } });
    expect(a.status).toBe("rejected");
    const ws = getWorkspace();
    expect(ws.auditLog[0]).toMatchObject({ action: "schema_rejected", agent: "band:r" });
    expect(ws.agentEvents.some((e) => e.fromRole === "planner" && /REPLAN/.test(e.text))).toBe(true);
    expect(isSafeSchemaChange("CREATE INDEX event_name IF NOT EXISTS FOR (n:Event) ON (n.name)")).toBe(true);
    expect(isSafeSchemaChange("MATCH (n) DETACH DELETE n")).toBe(false);
    expect(isSafeSchemaChange("CREATE CONSTRAINT x IF NOT EXISTS FOR (n:Event) REQUIRE n.id IS UNIQUE; MATCH (n) DELETE n")).toBe(false);
    expect(() => proposeSchemaChange({ cypher: "DROP INDEX company_domain", reason: "x", adds: "x", requestedBy: "builder" })).toThrow();
  });
});

describe("Band room (live, against a stubbed API)", () => {
  const P = [
    { id: "u_rep", type: "User", name: "Kam" },
    { id: "a_planner", type: "Agent", name: "Cited Planner" },
    { id: "a_builder", type: "Agent", name: "Cited Builder" },
    { id: "a_security", type: "Agent", name: "Cited Security" },
  ];
  function stub(inbox: { id: string; content: string; sender_id: string; sender_name: string; sender_type: string }[] = []) {
    const calls: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const path = url.replace("https://app.band.ai/api/v1", "");
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ method: init.method ?? "GET", path, body });
      const json = (status: number, data: unknown) => new Response(JSON.stringify({ data }), { status });
      if (path.endsWith("/participants")) return json(200, P);
      if (path === "/agent/me") return json(200, { id: "a_planner" }); // single key = planner identity
      if (path.endsWith("/messages/next")) { const m = inbox.shift(); return m ? json(200, m) : new Response(null, { status: 204 }); }
      if (/\/messages\/[^/]+\/(processing|processed|failed)$/.test(path)) return json(200, { ok: true });
      if (path.endsWith("/messages")) return json(201, { id: "m1", success: true });
      if (path.endsWith("/events")) return json(201, { id: "e1", success: true });
      return json(404, null);
    }));
    process.env.BAND_API_KEY = "band_a_test"; process.env.BAND_ROOM_ID = "room_1";
    return calls;
  }

  it("matches room participants to roles", () => {
    expect(participantFor(P as never, "builder")!.id).toBe("a_builder");
    expect(participantFor(P as never, "human")!.id).toBe("u_rep");
  });

  it("a handoff to another agent becomes an @mention message; a self-handoff becomes an event", async () => {
    const calls = stub();
    const ws = getWorkspace();
    expect(await mirrorEvent(agentEvent(ws, { from: "planner", to: "builder", kind: "handoff", text: "@builder TASK discover  icp=v1" }))).toBe("message");
    const msg = calls.find((c) => c.path === "/agent/chats/room_1/messages")!;
    expect(msg.body).toMatchObject({ message: { content: "@Cited Builder [planner] TASK discover  icp=v1", mentions: [{ id: "a_builder", name: "Cited Builder" }] } });
    expect(await mirrorEvent(agentEvent(ws, { from: "planner", to: "planner", kind: "note", text: "thinking" }))).toBe("event");
  });

  it("an approval request mentions the human and posts a blocking attention event", async () => {
    const calls = stub();
    await mirrorEvent(agentEvent(getWorkspace(), { from: "security", to: "human", kind: "approval", text: "@human APPROVAL outreach  batch=b_1" }));
    expect(calls.some((c) => c.path.endsWith("/messages") && JSON.stringify(c.body).includes("u_rep"))).toBe(true);
    expect(calls.find((c) => c.path.endsWith("/events"))!.body).toMatchObject({ event: { message_type: "attention", metadata: { kind: "review", blocking: true } } });
  });

  it("polls a human's reply, applies it, answers in the room, and ignores agents", async () => {
    const calls = stub([
      { id: "x1", content: "@[[a_security]] approve b_1 except msg_nw_e2 (too long for a CFO)", sender_id: "u_rep", sender_name: "Kam", sender_type: "User" },
      { id: "x2", content: "approve b_1", sender_id: "a_builder", sender_name: "Cited Builder", sender_type: "Agent" },
    ]);
    const r = await pollBand();
    expect(r.handled).toBe(1);
    expect(r.replies[0]).toMatch(/2 approved, 1 rejected/);
    expect(getWorkspace().approvals.find((a) => a.id === "apr_b1")!.decidedVia).toBe("band");
    expect(calls.filter((c) => /\/processed$/.test(c.path)).length).toBe(2);
    expect(calls.some((c) => c.path.endsWith("/messages") && JSON.stringify(c.body).includes("2 approved"))).toBe(true);
  });
});

describe("Band wake-up webhook", () => {
  it("accepts a valid Standard Webhooks signature and rejects a forged one", () => {
    const secret = "whsec_" + Buffer.from("supersecretkey123").toString("base64");
    const id = "msg_1", ts = String(Math.floor(Date.now() / 1000)), body = '{"type":"wakeup"}';
    const sig = crypto.createHmac("sha256", Buffer.from("supersecretkey123")).update(`${id}.${ts}.${body}`).digest("base64");
    const h = (s: string) => new Headers({ "webhook-id": id, "webhook-timestamp": ts, "webhook-signature": `v1,${s}` });
    expect(verifyBandWebhook(secret, h(sig), body)).toBe(true);
    expect(verifyBandWebhook(secret, h(sig.replace(/^./, "A")), body)).toBe(false);
    expect(verifyBandWebhook(secret, new Headers(), body)).toBe(false);
  });
});
