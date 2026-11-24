import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspace, mutate, agentEvent, audit } from "@/lib/db/store";
import { findMessage, assertReviewable, applyEdit, markSent, reject } from "@/lib/pipeline/review";
import { requireCredits, charge } from "@/lib/pipeline/credits";
import { sendEmail } from "@/lib/providers/sendgrid";
import { ApiError, route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const Body = z.object({
  decision: z.enum(["approve", "reject", "edit"]),
  edited: z.object({ subject: z.string().nullable().optional(), body: z.string().min(1).optional() }).optional(),
  note: z.string().optional(),
});

/**
 * POST /api/outreach/:id/review
 * approve: email → sent to the demo inbox (agent sends, rep approved); LinkedIn → approved, waiting for the rep to send by hand.
 * edit: save the rep's edit, stay pending. reject: back to @builder with the reason.
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const { message: m0 } = findMessage(getWorkspace(), id);
  assertReviewable(m0);

  if (body.decision === "reject") {
    const out = mutate((ws) => { const { message, lead } = findMessage(ws, id); reject(ws, message, body.note); return { message, lead }; });
    return NextResponse.json(out);
  }
  if (body.decision === "edit") {
    const out = mutate((ws) => {
      const { message, lead } = findMessage(ws, id);
      applyEdit(message, body.edited);
      audit(ws, { actor: "rep", agent: "ui", action: "message_edited", target: id, detail: "" });
      return { message, lead };
    });
    return NextResponse.json(out);
  }

  // approve
  if (m0.status === "needs_fix") throw new ApiError("INVALID_STATE", "Message failed review or security checks; edit it first");
  if (m0.channel === "linkedin") {
    const out = mutate((ws) => {
      const { message, lead } = findMessage(ws, id);
      applyEdit(message, body.edited);
      message.status = "approved";
      audit(ws, { actor: "rep", agent: "ui", action: "message_approved", target: id, detail: "LinkedIn: queued for manual send" });
      return { message, lead };
    });
    return NextResponse.json(out);
  }

  const person = getWorkspace().people.find((p) => p.id === m0.personId);
  if (!person?.email) throw new ApiError("INVALID_STATE", "Recipient has no verified email");
  requireCredits(getWorkspace(), "outreach_sent");
  mutate((ws) => { const { message } = findMessage(ws, id); applyEdit(message, body.edited); message.status = "approved"; audit(ws, { actor: "rep", agent: "ui", action: "message_approved", target: id, detail: message.editedByRep ? "edited by rep" : "" }); });

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
    return { message, lead };
  });
  return NextResponse.json({ ...out, deliveredTo: result.simulated ? "demo inbox (simulated)" : `sendgrid -> ${result.to}` });
});
