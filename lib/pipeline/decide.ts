import "server-only";
import type { Approval, Message } from "@/lib/types";
import { getWorkspace, mutate, agentEvent, audit } from "@/lib/db/store";
import { findMessage, assertReviewable, applyEdit, markSent, reject } from "./review";
import { requireCredits, charge } from "./credits";
import { claimCheck } from "./evidence";
import { sendEmail } from "@/lib/providers/sendgrid";
import { formatHandoff } from "@/lib/providers/band";
import { ApiError } from "@/lib/api/errors";
import { runCypher, graphEngine } from "@/lib/graph/neo4j";

/**
 * One decision path for every human approval, whichever surface it came from. A click in Cited's
 * queue and a reply in the Band room write the same rows; only `agent` differs ("ui" or "band:<room>").
 */
export type Via = { kind: "ui" } | { kind: "band"; room: string };
export const viaAgent = (v: Via) => (v.kind === "ui" ? "ui" : `band:${v.room}`);

async function recheck(m: Message, edited?: { subject?: string | null; body?: string }) {
  const ws = getWorkspace();
  const lead = ws.leads.find((l) => l.id === m.leadId)!;
  const company = ws.companies.find((c) => c.id === lead.companyId)!;
  const subject = edited?.subject !== undefined ? edited.subject : m.subject;
  const body = edited?.body ?? m.body;
  return claimCheck(`${subject ?? ""}\n${body}`, { companyId: company.id, companyName: company.name, productName: ws.product?.name ?? "" });
}

/** Close an outreach batch approval once none of its messages is waiting on a human. */
function settleBatches(ws: ReturnType<typeof getWorkspace>, via: Via) {
  for (const a of ws.approvals.filter((x) => x.kind === "outreach" && x.status === "pending")) {
    const ids = (a.payload.messageIds as string[] | undefined) ?? [];
    const msgs = ws.messages.filter((m) => ids.includes(m.id));
    if (msgs.some((m) => m.status === "pending_approval" || m.status === "needs_fix")) continue;
    const approved = msgs.filter((m) => m.status === "approved" || m.status === "sent").length;
    a.status = approved ? "approved" : "rejected";
    a.decidedBy = "rep"; a.decidedVia = via.kind;
    a.note = `${approved} approved, ${msgs.length - approved} rejected`;
  }
}

export async function reviewMessage(id: string, decision: "approve" | "reject" | "edit", opts: { edited?: { subject?: string | null; body?: string }; note?: string; via: Via }) {
  const agent = viaAgent(opts.via);
  const { message: m0 } = findMessage(getWorkspace(), id);
  assertReviewable(m0);

  if (decision === "reject") {
    return mutate((ws) => {
      const { message, lead } = findMessage(ws, id);
      reject(ws, message, opts.note, agent);
      settleBatches(ws, opts.via);
      return { message, lead };
    });
  }
  if (decision === "edit") {
    const cc = await recheck(m0, opts.edited);
    return mutate((ws) => {
      const { message, lead } = findMessage(ws, id);
      applyEdit(message, opts.edited);
      message.review = { ...(message.review ?? {}), grounding: { claims: cc.claims, ms: cc.ms, engine: cc.engine } };
      audit(ws, { actor: "rep", agent, action: "message_edited", target: id, detail: "" });
      return { message, lead };
    });
  }

  // approve: nothing goes out with a claim Moss can't find evidence for.
  const cc = await recheck(m0, opts.edited);
  if (cc.unsupported.length) {
    mutate((ws) => { const { message } = findMessage(ws, id); message.review = { ...(message.review ?? {}), grounding: { claims: cc.claims, ms: cc.ms, engine: cc.engine } }; });
    throw new ApiError("UNCITED_CLAIM", `No evidence for: "${cc.unsupported[0]}"`, { unsupported: cc.unsupported });
  }
  if (m0.status === "needs_fix" && !opts.edited) throw new ApiError("INVALID_STATE", "Message failed review or security checks; edit it first");
  if (m0.channel === "linkedin") {
    return mutate((ws) => {
      const { message, lead } = findMessage(ws, id);
      applyEdit(message, opts.edited);
      message.status = "approved";
      audit(ws, { actor: "rep", agent, action: "message_approved", target: id, detail: "LinkedIn: queued for manual send" });
      settleBatches(ws, opts.via);
      return { message, lead };
    });
  }

  const person = getWorkspace().people.find((p) => p.id === m0.personId);
  if (!person?.email) throw new ApiError("INVALID_STATE", "Recipient has no verified email");
  requireCredits(getWorkspace(), "outreach_sent");
  mutate((ws) => { const { message } = findMessage(ws, id); applyEdit(message, opts.edited); message.status = "approved"; audit(ws, { actor: "rep", agent, action: "message_approved", target: id, detail: message.editedByRep ? "edited by rep" : "" }); });

  const m1 = findMessage(getWorkspace(), id).message;
  let result;
  try {
    result = await sendEmail({ to: person.email, subject: m1.subject ?? "", body: m1.body });
  } catch (e) {
    mutate((ws) => audit(ws, { actor: "agent", agent: "builder", action: "send_failed", target: id, detail: (e as Error).message }));
    throw e;
  }
  const out = mutate((ws) => {
    const { message, lead } = findMessage(ws, id);
    markSent(ws, message, lead, { deliveredTo: result.deliveredTo, actor: "agent", detail: `rep approved, agent sent → ${result.simulated ? "demo inbox (simulated)" : result.to}` });
    charge(ws, "outreach_sent", lead.id);
    agentEvent(ws, { from: "human", to: "builder", kind: "decision", text: `APPROVED ${id}${message.editedByRep ? " (edited)" : ""}; sent to demo inbox` });
    settleBatches(ws, opts.via);
    return { message, lead };
  });
  return { ...out, deliveredTo: result.simulated ? "demo inbox (simulated)" : `sendgrid -> ${result.to}` };
}

export interface BatchOutcome { approved: string[]; rejected: string[]; failed: { id: string; error: string }[]; approval: Approval }

/** Decide a whole outreach batch: reject the listed messages (with reasons), approve the rest. */
export async function decideBatch(approvalId: string, opts: { reject?: Record<string, string>; rejectAll?: string; via: Via }): Promise<BatchOutcome> {
  const a = getWorkspace().approvals.find((x) => x.id === approvalId || x.payload.batch === approvalId);
  if (!a || a.kind !== "outreach") throw new ApiError("NOT_FOUND", `Outreach approval ${approvalId} not found`);
  if (a.status !== "pending") throw new ApiError("INVALID_STATE", `Batch is already ${a.status}`);
  const ids = ((a.payload.messageIds as string[]) ?? []).filter((id) => {
    const m = getWorkspace().messages.find((x) => x.id === id);
    return m && (m.status === "pending_approval" || m.status === "needs_fix");
  });
  const out: BatchOutcome = { approved: [], rejected: [], failed: [], approval: a };
  for (const id of ids) {
    const reason = opts.rejectAll ?? opts.reject?.[id];
    try {
      if (reason !== undefined) { await reviewMessage(id, "reject", { note: reason, via: opts.via }); out.rejected.push(id); }
      else { await reviewMessage(id, "approve", { via: opts.via }); out.approved.push(id); }
    } catch (e) { out.failed.push({ id, error: (e as Error).message }); }
  }
  mutate((ws) => {
    const b = a.payload.batch as string;
    audit(ws, { actor: "rep", agent: viaAgent(opts.via), action: "batch_decided", target: b, detail: `${out.approved.length} approved, ${out.rejected.length} rejected${out.failed.length ? `, ${out.failed.length} could not be approved` : ""}` });
    agentEvent(ws, { from: "human", to: "security", kind: "decision", text: formatHandoff({ to: "security", verb: "DECISION", args: { batch: b, approved: String(out.approved.length), rejected: String(out.rejected.length) }, rest: "" }) });
    if (out.rejected.length) agentEvent(ws, { from: "security", to: "builder", kind: "handoff", text: formatHandoff({ to: "builder", verb: "FIX", args: { batch: b }, rest: out.rejected.map((id) => `${id}: ${opts.rejectAll ?? opts.reject?.[id] ?? "rejected"}`).join("; ") }) });
    out.approval = ws.approvals.find((x) => x.id === a.id)!;
  });
  return out;
}

/** Schema changes may only add constraints or indexes, idempotently; anything else is refused before a human sees it. */
const SAFE_SCHEMA = /^\s*CREATE\s+(CONSTRAINT|INDEX)\s+\w+\s+IF\s+NOT\s+EXISTS\s+FOR\s+\([a-z]:\w+\)\s+(REQUIRE|ON)\s[^;]*$/i;
export function isSafeSchemaChange(cypher: string) { return cypher.split(";").map((s) => s.trim()).filter(Boolean).every((s) => SAFE_SCHEMA.test(s)); }

export function proposeSchemaChange(p: { cypher: string; reason: string; adds: string; requestedBy: "builder" | "planner" }) {
  if (!isSafeSchemaChange(p.cypher)) throw new ApiError("VALIDATION_ERROR", "Schema changes may only CREATE CONSTRAINT/INDEX ... IF NOT EXISTS");
  return mutate((ws) => {
    const approval: Approval = { id: `apr_schema_${ws.approvals.length + 1}`, kind: "schema", requestedBy: p.requestedBy, payload: { cypher: p.cypher, reason: p.reason, adds: p.adds }, status: "pending", decidedBy: null, decidedVia: null, note: null, at: new Date().toISOString() };
    ws.approvals.push(approval);
    agentEvent(ws, { from: p.requestedBy, to: "human", kind: "approval", text: formatHandoff({ to: "human", verb: "APPROVAL", args: { schema: approval.id, adds: p.adds.replace(/\s+/g, "_") }, rest: p.reason }) });
    return approval;
  });
}

export async function decideSchema(approvalId: string, decision: "approve" | "reject", opts: { note?: string; via: Via }) {
  const a = getWorkspace().approvals.find((x) => x.id === approvalId);
  if (!a || a.kind !== "schema") throw new ApiError("NOT_FOUND", `Schema approval ${approvalId} not found`);
  if (a.status !== "pending") throw new ApiError("INVALID_STATE", `Already ${a.status}`);
  let ran = "recorded (in-memory graph needs no migration)";
  if (decision === "approve" && graphEngine() === "neo4j") {
    for (const s of String(a.payload.cypher).split(";").map((x) => x.trim()).filter(Boolean)) await runCypher(s);
    ran = "migration ran on Neo4j";
  }
  return mutate((ws) => {
    const x = ws.approvals.find((y) => y.id === approvalId)!;
    x.status = decision === "approve" ? "approved" : "rejected";
    x.decidedBy = "rep"; x.decidedVia = opts.via.kind; x.note = opts.note ?? null;
    audit(ws, { actor: "rep", agent: viaAgent(opts.via), action: decision === "approve" ? "schema_approved" : "schema_rejected", target: x.id, detail: `${x.payload.adds}${decision === "approve" ? `: ${ran}` : opts.note ? `: ${opts.note}` : ""}` });
    agentEvent(ws, { from: "human", to: x.requestedBy, kind: "decision", text: `${decision === "approve" ? "APPROVED" : "REJECTED"} schema ${x.id}${opts.note ? `: ${opts.note}` : ""}` });
    if (decision === "reject") agentEvent(ws, { from: "planner", to: "builder", kind: "handoff", text: formatHandoff({ to: "builder", verb: "REPLAN", args: { without: String(x.payload.adds).replace(/\s+/g, "_") }, rest: "warm paths keep using past employers and schools" }) });
    return x;
  });
}

/** The demo's second HITL beat: @builder asks to add an `attended` edge for events. */
export const DEMO_SCHEMA = {
  cypher: "CREATE CONSTRAINT event_id IF NOT EXISTS FOR (n:Event) REQUIRE n.id IS UNIQUE",
  reason: "Conference attendance would add warm paths through shared events",
  adds: "Event node + attended edge",
  requestedBy: "builder" as const,
};
