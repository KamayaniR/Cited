import "server-only";
import fs from "fs";
import path from "path";
import { env, isLive } from "@/lib/env";
import type { Workspace } from "@/lib/types";
import { buildGraph, type GEdge, type GNode } from "./model";

/**
 * Neo4j access. When NEO4J_* keys are missing, callers use the in-memory graph built from the
 * workspace (lib/graph/model.ts + queries.ts) and return the same row shape with engine="memory".
 */
type Driver = import("neo4j-driver").Driver;
const g = globalThis as unknown as { __neo4j?: Driver; __neo4jSchema?: boolean };

export function graphEngine(): "neo4j" | "memory" {
  return isLive("neo4j") ? "neo4j" : "memory";
}

async function driver(): Promise<Driver> {
  if (g.__neo4j) return g.__neo4j;
  const neo4j = (await import("neo4j-driver")).default;
  g.__neo4j = neo4j.driver(env.neo4jUri!, neo4j.auth.basic(env.neo4jUser, env.neo4jPassword!));
  return g.__neo4j;
}

export async function runCypher<T = Record<string, unknown>>(cypher: string, params: Record<string, unknown> = {}): Promise<T[]> {
  const d = await driver();
  await ensureSchema();
  const session = d.session();
  try {
    const res = await session.run(cypher, params);
    return res.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}

/** Runs lib/graph/schema.cypher once per process. Statements use IF NOT EXISTS, so reruns are safe. */
export async function ensureSchema() {
  if (g.__neo4jSchema) return;
  const d = await driver();
  const file = fs.readFileSync(path.join(process.cwd(), "lib/graph/schema.cypher"), "utf8");
  const statements = file.split(";").map((s) => s.replace(/\/\/.*$/gm, "").trim()).filter(Boolean);
  const session = d.session();
  try {
    for (const s of statements) await session.run(s);
    g.__neo4jSchema = true;
  } finally {
    await session.close();
  }
}

/**
 * Mirror the workspace graph into Neo4j: drop this org's nodes, then batched UNWIND + MERGE per
 * label and per edge type. Small graphs (hundreds of nodes) make a full rewrite the simplest way
 * to stay consistent with the records.
 */
export async function syncGraph(ws: Workspace): Promise<{ nodes: number; edges: number }> {
  const g = buildGraph(ws);
  const org = ws.org.id;
  await runCypher("MATCH (n {org: $org}) DETACH DELETE n", { org });
  const byLabel = new Map<string, GNode[]>();
  for (const n of g.nodes.values()) byLabel.set(n.label, [...(byLabel.get(n.label) ?? []), n]);
  for (const [label, nodes] of byLabel) {
    await runCypher(`UNWIND $rows AS r MERGE (n:${label} {id: r.id}) SET n += r.props, n.org = $org`, { org, rows: nodes.map((n) => ({ id: n.id, props: n.props })) });
  }
  const byType = new Map<string, GEdge[]>();
  for (const e of g.edges) {
    const key = `${e.type}|${g.nodes.get(e.from)!.label}|${g.nodes.get(e.to)!.label}`;
    byType.set(key, [...(byType.get(key) ?? []), e]);
  }
  for (const [key, edges] of byType) {
    const [type, fromLabel, toLabel] = key.split("|");
    await runCypher(
      `UNWIND $rows AS r MATCH (a:${fromLabel} {id: r.from, org: $org}) MATCH (b:${toLabel} {id: r.to, org: $org}) MERGE (a)-[e:${type}]->(b) SET e += r.props`,
      { org, rows: edges.map((e) => ({ from: e.from, to: e.to, props: e.props })) },
    );
  }
  return { nodes: g.nodes.size, edges: g.edges.length };
}
