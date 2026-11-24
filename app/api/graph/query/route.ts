import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspace, mutate, audit } from "@/lib/db/store";
import { requireCredits, charge } from "@/lib/pipeline/credits";
import { runGraphQuery } from "@/lib/graph/run";
import { QUERY_INFO } from "@/lib/graph/queries";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
const Q = z.object({ q: z.enum(["warm", "hiring", "displacement"]) });

/** GET /api/graph/query?q=warm|hiring|displacement → { rows, engine, cypher }. 1 credit per query. */
export const GET = route(async (req: Request) => {
  const { q } = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  requireCredits(getWorkspace(), "graph_query");
  const r = await runGraphQuery(getWorkspace(), q);
  mutate((ws) => {
    charge(ws, "graph_query", null);
    audit(ws, { actor: "rep", agent: "ui", action: "graph_query", target: q, detail: `${QUERY_INFO[q].title}: ${r.rows.length} rows (${r.engine})` });
  });
  return NextResponse.json({ q, ...QUERY_INFO[q], ...r });
});
