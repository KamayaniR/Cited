import type { Workspace, Message, Lead, Stage, Actor } from "@/lib/types";
import { ApiError } from "@/lib/api/errors";
import { newId, nowIso } from "@/lib/ids";
import { audit, agentEvent } from "@/lib/db/store";

export function findMessage(ws: Workspace, id: string) {
  const message = ws.messages.find((m) => m.id === id);
  if (!message) throw new ApiError("NOT_FOUND", `Message ${id} not found`);
  const lead = ws.leads.find((l) => l.id === message.leadId)!;
  return { message, lead };
}

/** Approve/edit/reject preconditions. Throws 409 for anything already decided. */
export function assertReviewable(m: Message) {
  if (m.status === "sent") throw new ApiError("INVALID_STATE", "Message was already sent");
  if (m.status === "approved") throw new ApiError("INVALID_STATE", "Message was already approved");
  if (m.status === "rejected") throw new ApiError("INVALID_STATE", "Message was rejected; regenerate the sequence");
}

export function moveStage(ws: Workspace, lead: Lead, to: Stage, actor: Actor, note: string) {
  if (lead.stage === to) return;
  ws.leadEvents.push({ id: newId("lev"), leadId: lead.id, fromStage: lead.stage, toStage: to, actor, note, at: nowIso() });
  lead.stage = to;
  lead.owner = actor;
}

/** After any first send (email by agent, LinkedIn by rep), the lead moves Matched → Contacted. */
export function markSent(ws: Workspace, m: Message, lead: Lead, via: { deliveredTo: Message["deliveredTo"]; actor: Actor; detail: string }) {
  m.status = "sent";
  m.sentAt = nowIso();
  m.deliveredTo = via.deliveredTo;
  audit(ws, { actor: via.actor, agent: via.actor === "agent" ? "builder" : "ui", action: m.channel === "linkedin" ? "linkedin_marked_sent" : "email_sent", target: m.id, detail: via.detail });
  if (lead.stage === "matched") moveStage(ws, lead, "contacted", via.actor, `First touch sent (${m.channel})`);
}

export function applyEdit(m: Message, edited?: { subject?: string | null; body?: string }) {
  if (!edited) return;
  if (edited.body !== undefined && edited.body !== m.body) { m.body = edited.body; m.editedByRep = true; }
  if (edited.subject !== undefined && edited.subject !== m.subject) { m.subject = edited.subject; m.editedByRep = true; }
}

export function reject(ws: Workspace, m: Message, note?: string, agent = "ui") {
  m.status = "rejected";
  m.review = { ...(m.review ?? {}), notes: [...(m.review?.notes ?? []), `Rejected by rep${note ? `: ${note}` : ""}`] };
  audit(ws, { actor: "rep", agent, action: "message_rejected", target: m.id, detail: note ?? "" });
  agentEvent(ws, { from: "human", to: "builder", kind: "decision", text: `REJECTED ${m.id}${note ? `  reason="${note}"` : ""}` });
}
