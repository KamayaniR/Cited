import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/db/store";
import { buildGraph, graphStats } from "@/lib/graph/model";
import { graphEngine } from "@/lib/graph/neo4j";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** GET /api/graph: node and edge counts by type (free; queries cost a credit). */
export const GET = route(async () => {
  return NextResponse.json({ engine: graphEngine(), ...graphStats(buildGraph(getWorkspace())) });
});
