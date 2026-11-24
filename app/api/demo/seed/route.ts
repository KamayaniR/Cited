import { NextResponse } from "next/server";
import { mirrorGraph } from "@/lib/graph/run";
import { replaceWorkspace, emptyWorkspace } from "@/lib/db/store";
import { buildDemoWorkspace } from "@/lib/seed/demo";
import { route, ApiError } from "@/lib/api/errors";
import { isDemoMode } from "@/lib/env";
import { syncEvidence } from "@/lib/pipeline/evidence";
import { resetMockIndex } from "@/lib/providers/moss";

export const dynamic = "force-dynamic";

/** POST /api/demo/seed: load the deterministic demo workspace (demo mode only). */
export const POST = route(async () => {
  // The live app only ever shows real data. Demo data loads only in demo mode (CITED_FORCE_MOCK=true).
  if (!isDemoMode()) throw new ApiError("INVALID_STATE", "Demo data is only available in demo mode. The live app uses real data only.");
  const ws = buildDemoWorkspace();
  replaceWorkspace(ws);
  resetMockIndex();
  const indexed = await syncEvidence(ws);
  const graph = await mirrorGraph(ws);
  return NextResponse.json({ graph, ok: true, evidenceIndexed: indexed.count, companies: ws.companies.length, leads: ws.leads.length });
});

/** DELETE /api/demo/seed: reset to an empty workspace. */
export const DELETE = route(async () => {
  replaceWorkspace(emptyWorkspace());
  resetMockIndex();
  return NextResponse.json({ ok: true });
});
