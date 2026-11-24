import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/db/store";
import { buildGraph, graphStats } from "@/lib/graph/model";
import { graphEngine } from "@/lib/graph/neo4j";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** GET /api/graph: node and edge counts by type (free; queries cost a credit). */
export const GET = route(async (req: Request) => {
  const g = buildGraph(getWorkspace());
  const full = new URL(req.url).searchParams.get("full") === "1";
  // ?full=1 adds the nodes and edges themselves, for the network view.
  const extra = full ? { graph: { nodes: [...g.nodes.values()], edges: g.edges.map(({ type, from, to }) => ({ type, from, to })) } } : {};
  return NextResponse.json({ engine: graphEngine(), ...graphStats(g), ...extra });
});
