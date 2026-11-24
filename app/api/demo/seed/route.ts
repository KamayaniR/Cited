import { NextResponse } from "next/server";
import { mirrorGraph } from "@/lib/graph/run";
import { replaceWorkspace, emptyWorkspace } from "@/lib/db/store";
import { buildDemoWorkspace } from "@/lib/seed/demo";
import { route } from "@/lib/api/errors";
import { syncEvidence } from "@/lib/pipeline/evidence";
import { resetMockIndex } from "@/lib/providers/moss";

export const dynamic = "force-dynamic";

/** POST /api/demo/seed: load the deterministic demo workspace (mock mode). */
export const POST = route(async () => {
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
