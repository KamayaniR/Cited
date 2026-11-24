import { NextResponse } from "next/server";
import { z } from "zod";
import { proposeSchemaChange, DEMO_SCHEMA } from "@/lib/pipeline/decide";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const Body = z.object({
  cypher: z.string().min(10).max(2000),
  reason: z.string().min(3).max(500),
  adds: z.string().min(1).max(120),
  requestedBy: z.enum(["builder", "planner"]),
}).partial();

/** POST /api/schema/propose: an agent asks to change the graph schema; it waits for a human. */
export const POST = route(async (req: Request) => {
  const body = Body.parse(await req.json().catch(() => ({})));
  return NextResponse.json({ approval: proposeSchemaChange({ ...DEMO_SCHEMA, ...body }) });
});
