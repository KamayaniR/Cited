import { NextResponse } from "next/server";
import { z } from "zod";
import { mutate, audit } from "@/lib/db/store";
import { ApiError, route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const Body = z.object({ status: z.enum(["accepted", "adjusted", "dismissed"]), adjusted: z.string().min(3).optional() });

/** POST /api/icp/expansions/:id: accept, adjust (with a new segment text) or dismiss. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  if (body.status === "adjusted" && !body.adjusted) throw new ApiError("VALIDATION_ERROR", "adjusted requires the new segment text");
  const expansion = mutate((ws) => {
    const e = ws.expansions.find((x) => x.id === id);
    if (!e) throw new ApiError("NOT_FOUND", `Expansion ${id} not found`);
    e.status = body.status;
    if (body.adjusted) e.segment = body.adjusted;
    audit(ws, { actor: "rep", agent: "ui", action: `expansion_${body.status}`, target: id, detail: e.segment });
    return e;
  });
  return NextResponse.json({ expansion });
});
