import { NextResponse } from "next/server";
import { z } from "zod";
import { IcpSchema } from "@/lib/types";
import { mutate, audit, agentEvent } from "@/lib/db/store";
import { ApiError, route } from "@/lib/api/errors";
import { nowIso } from "@/lib/ids";

export const dynamic = "force-dynamic";

const Body = z.object({ icp: IcpSchema.optional(), approve: z.boolean().optional() });

/** PATCH /api/icp: edit the ICP (creates a new version) and/or approve it. */
export const PATCH = route(async (req: Request) => {
  const body = Body.parse(await req.json());
  const icp = mutate((ws) => {
    if (!ws.icp) throw new ApiError("NOT_FOUND", "No ICP yet. Submit intake first.");
    if (body.icp) {
      ws.icp = { ...ws.icp, version: ws.icp.version + 1, data: body.icp, approvedAt: null };
      audit(ws, { actor: "rep", agent: "ui", action: "icp_edited", target: ws.icp.id, detail: `ICP v${ws.icp.version}` });
    }
    if (body.approve) {
      ws.icp.approvedAt = nowIso();
      for (const a of ws.approvals) if (a.kind === "icp" && a.status === "pending") Object.assign(a, { status: "approved", decidedBy: "rep", decidedVia: "ui" });
      audit(ws, { actor: "rep", agent: "ui", action: "icp_approved", target: ws.icp.id, detail: `ICP v${ws.icp.version} approved` });
      agentEvent(ws, { from: "human", to: "planner", kind: "decision", text: `APPROVED icp v${ws.icp.version}` });
    }
    return ws.icp;
  });
  return NextResponse.json({ icp });
});
