import "server-only";
import type { Workspace } from "@/lib/types";
import { CYPHER, queryMemory, type QueryKey, type Row } from "./queries";
import { graphEngine, runCypher, syncGraph } from "./neo4j";

export interface QueryResult { rows: Row[]; engine: "neo4j" | "memory"; cypher: string; ms: number; fallback?: string }

/** Neo4j when configured (synced first so it reflects the latest records), memory otherwise or on failure. */
export async function runGraphQuery(ws: Workspace, q: QueryKey): Promise<QueryResult> {
  const t = performance.now();
  if (graphEngine() === "neo4j") {
    try {
      await syncGraph(ws);
      const rows = await runCypher<Record<string, unknown>>(CYPHER[q], { org: ws.org.id });
      return { rows: rows.map(plain) as unknown as Row[], engine: "neo4j", cypher: CYPHER[q], ms: performance.now() - t };
    } catch (e) {
      const rows = queryMemory(ws, q);
      return { rows, engine: "memory", cypher: CYPHER[q], ms: performance.now() - t, fallback: `Neo4j failed (${(e as Error).message}); answered from the in-memory graph` };
    }
  }
  return { rows: queryMemory(ws, q), engine: "memory", cypher: CYPHER[q], ms: performance.now() - t };
}

/** Best-effort mirror after writes (discovery, enrichment, refresh). Never blocks the pipeline. */
export async function mirrorGraph(ws: Workspace): Promise<string> {
  if (graphEngine() !== "neo4j") return "memory";
  try { const r = await syncGraph(ws); return `neo4j: ${r.nodes} nodes, ${r.edges} edges`; }
  catch (e) { console.warn("[neo4j] sync failed:", (e as Error).message); return "neo4j sync failed"; }
}

/** neo4j-driver returns Integer objects for numbers; flatten them. */
function plain(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    out[k] = v && typeof v === "object" && "toNumber" in (v as object) ? (v as { toNumber(): number }).toNumber() : v;
  }
  return out;
}
