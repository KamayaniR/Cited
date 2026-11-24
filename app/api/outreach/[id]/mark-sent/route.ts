import { NextResponse } from "next/server";
import { mutate } from "@/lib/db/store";
import { findMessage, markSent } from "@/lib/pipeline/review";
import { ApiError, route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** POST /api/outreach/:id/mark-sent: the rep sent an approved LinkedIn message by hand. Cited never sends LinkedIn. */
export const POST = route(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const out = mutate((ws) => {
    const { message, lead } = findMessage(ws, id);
    if (message.channel !== "linkedin") throw new ApiError("INVALID_STATE", "mark-sent is only for LinkedIn messages");
    if (message.status === "sent") throw new ApiError("INVALID_STATE", "Already marked sent");
    if (message.status !== "approved") throw new ApiError("INVALID_STATE", "Approve the message first");
    markSent(ws, message, lead, { deliveredTo: "manual:linkedin", actor: "rep", detail: "Sent by hand on LinkedIn" });
    return { message, lead };
  });
  return NextResponse.json(out);
});
