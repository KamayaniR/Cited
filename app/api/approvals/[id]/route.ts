import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspace } from "@/lib/db/store";
import { decideBatch, decideSchema } from "@/lib/pipeline/decide";
import { ApiError, route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  decision: z.enum(["approve", "reject"]),
  /** outreach: message ids to reject (with reasons) while approving the rest */
  reject: z.record(z.string(), z.string().max(300)).optional(),
  note: z.string().max(500).optional(),
});

/** POST /api/approvals/:id: decide an outreach batch or a schema change. Same path as a Band reply. */
export const POST = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  const a = getWorkspace().approvals.find((x) => x.id === id);
  if (!a) throw new ApiError("NOT_FOUND", `Approval ${id} not found`);
  if (a.kind === "outreach") {
    const r = body.decision === "approve"
      ? await decideBatch(id, { reject: body.reject, via: { kind: "ui" } })
      : await decideBatch(id, { rejectAll: body.note ?? "rejected", via: { kind: "ui" } });
    return NextResponse.json(r);
  }
  if (a.kind === "schema") return NextResponse.json({ approval: await decideSchema(id, body.decision, { note: body.note, via: { kind: "ui" } }) });
  throw new ApiError("INVALID_STATE", "ICP approvals are decided on the Intake page");
});
