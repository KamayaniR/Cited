import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspace, mutate, agentEvent, audit } from "@/lib/db/store";
import { buildSequence, draftQueue } from "@/lib/pipeline/outreach";
import { ApiError, route } from "@/lib/api/errors";
import { formatHandoff } from "@/lib/providers/band";
import { newId, nowIso } from "@/lib/ids";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({ leadIds: z.array(z.string()).optional() }).default({});

/** POST /api/outreach/generate: draft 3-touch sequences → Reviewer fix loop → Security → human approval batch. */
export const POST = route(async (req: Request) => {
  const body = Body.parse(await req.json().catch(() => ({})));
  const ws0 = getWorkspace();
  if (!ws0.product) throw new ApiError("NOT_FOUND", "Run intake first.");
  const queue = draftQueue(ws0, body.leadIds);
  if (!queue.length) return NextResponse.json({ messages: [], batch: null });

  const batch = `b_${newId("").slice(1, 7)}`;
  mutate((ws) => agentEvent(ws, { from: "planner", to: "builder", kind: "handoff", text: formatHandoff({ to: "builder", verb: "TASK", args: { leads: String(queue.length), batch }, rest: "draft" }) }));

  const all = [];
  for (const lead of queue) {
    const r = await buildSequence(getWorkspace(), lead);
    all.push(...r.messages);
    mutate((ws) => {
      ws.messages.push(...r.messages);
      agentEvent(ws, { from: "builder", to: "builder", kind: "retrieval", text: `Moss: ${r.evidence.count} evidence docs for ${lead.id} in ${r.evidence.ms.toFixed(1)} ms; claim check ${r.claimMs.toFixed(1)} ms (${r.evidence.engine})` });
      agentEvent(ws, { from: "builder", to: "reviewer", kind: "handoff", text: formatHandoff({ to: "reviewer", verb: "READY", args: { batch, lead: lead.id, messages: String(r.messages.length) }, rest: "drafts" }), tokens: r.tokens, costUsd: r.costUsd });
      r.fixes.slice(0, -1).forEach((f, i) => f.length && agentEvent(ws, { from: "reviewer", to: "builder", kind: "fix", text: `@builder FIX  batch=${batch}  round=${i + 1}  ${f.join("; ")}` }));
      const final = r.fixes[r.fixes.length - 1];
      if (final.length) agentEvent(ws, { from: "reviewer", to: "human", kind: "escalation", text: `@human ESCALATE  batch=${batch}  lead=${lead.id}  still failing after ${r.rounds} fix rounds: ${final.join("; ")}` });
      if (r.blocks.length) agentEvent(ws, { from: "security", to: "human", kind: "block", text: `BLOCK  lead=${lead.id}  ${r.blocks.join("; ")}` });
    });
  }

  const pending = all.filter((m) => m.status === "pending_approval");
  mutate((ws) => {
    agentEvent(ws, { from: "reviewer", to: "security", kind: "handoff", text: formatHandoff({ to: "security", verb: "READY", args: { batch, reviewer: "pass" }, rest: "" }) });
    const domains = new Set(pending.flatMap((m) => [...m.body.matchAll(/https?:\/\/([^/\s]+)/g)].map((x) => x[1])));
    agentEvent(ws, { from: "security", to: "human", kind: "approval", text: formatHandoff({ to: "human", verb: "APPROVAL", args: { batch, messages: String(pending.length), links: `${domains.size}` }, rest: "outreach (all links cited)" }) });
    ws.approvals.push({ id: newId("apr"), kind: "outreach", requestedBy: "security", payload: { batch, messageIds: pending.map((m) => m.id) }, status: "pending", decidedBy: null, decidedVia: null, note: null, at: nowIso() });
    audit(ws, { actor: "agent", agent: "builder", action: "drafts_generated", target: batch, detail: `${all.length} messages for ${queue.length} leads, ${pending.length} awaiting approval` });
  });
  return NextResponse.json({ messages: all, batch });
});
