import { NextResponse } from "next/server";
import { ProductInputSchema } from "@/lib/types";
import { inferIcp } from "@/lib/pipeline/icp";
import { mutate, audit, agentEvent, emptyWorkspace } from "@/lib/db/store";
import { route } from "@/lib/api/errors";
import { newId } from "@/lib/ids";
import { formatHandoff } from "@/lib/providers/band";
import { syncEvidence } from "@/lib/pipeline/evidence";
import { getWorkspace } from "@/lib/db/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** POST /api/intake: ProductInput → { icp, expansions }. Starts a fresh workspace for the new product. */
export const POST = route(async (req: Request) => {
  const product = ProductInputSchema.parse(await req.json());
  const started = Date.now();
  const res = await inferIcp(product);

  const out = mutate((ws) => {
    const fresh = emptyWorkspace();
    Object.assign(ws, { ...fresh, org: ws.org, auditLog: ws.auditLog, usageEvents: ws.usageEvents });
    ws.product = { id: newId("prod"), ...product };
    ws.icp = { id: newId("icp"), version: 1, data: res.icp, approvedAt: null };
    ws.expansions = res.expansions;
    agentEvent(ws, { from: "planner", to: "builder", kind: "handoff", text: formatHandoff({ to: "builder", verb: "TASK", args: { icp: "draft", product: ws.product.id }, rest: "" }) });
    agentEvent(ws, { from: "builder", to: "planner", kind: "result", text: `ICP drafted in ${((Date.now() - started) / 1000).toFixed(1)}s: ${res.icp.industries.length} industries, ${res.icp.personas.length} personas, ${res.icp.triggers.length} triggers, ${res.expansions.length} expansion segments`, tokens: res.tokens, costUsd: res.costUsd });
    agentEvent(ws, { from: "planner", to: "human", kind: "approval", text: formatHandoff({ to: "human", verb: "APPROVAL", args: { icp: "v1", min_confidence: Math.min(...res.icp.industries.map((i) => i.confidence), ...res.icp.personas.map((p) => p.confidence)).toFixed(2) }, rest: "" }) });
    ws.approvals.push({ id: newId("apr"), kind: "icp", requestedBy: "planner", payload: { icpId: ws.icp.id }, status: "pending", decidedBy: null, decidedVia: null, note: null, at: new Date().toISOString() });
    audit(ws, { actor: "rep", agent: "ui", action: "intake_submitted", target: ws.product.id, detail: product.name });
    return { icp: ws.icp, expansions: ws.expansions };
  });
  await syncEvidence(getWorkspace());
  return NextResponse.json({ ...out, mode: res.mode });
});
