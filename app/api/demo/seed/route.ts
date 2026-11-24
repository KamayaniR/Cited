import { NextResponse } from "next/server";
import { replaceWorkspace, emptyWorkspace } from "@/lib/db/store";
import { buildDemoWorkspace } from "@/lib/seed/demo";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** POST /api/demo/seed: load the deterministic demo workspace (mock mode). */
export const POST = route(async () => {
  const ws = buildDemoWorkspace();
  replaceWorkspace(ws);
  return NextResponse.json({ ok: true, companies: ws.companies.length, leads: ws.leads.length });
});

/** DELETE /api/demo/seed: reset to an empty workspace. */
export const DELETE = route(async () => {
  replaceWorkspace(emptyWorkspace());
  return NextResponse.json({ ok: true });
});
