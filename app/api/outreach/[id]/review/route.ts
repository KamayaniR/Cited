import { NextResponse } from "next/server";
import { z } from "zod";
import { reviewMessage } from "@/lib/pipeline/decide";
import { route } from "@/lib/api/errors";

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
 * Same code path as a decision made in the Band room (lib/pipeline/decide.ts).
 */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  return NextResponse.json(await reviewMessage(id, body.decision, { edited: body.edited, note: body.note, via: { kind: "ui" } }));
});
