import "server-only";
import fs from "fs";
import path from "path";
import { env, isLive } from "@/lib/env";

/**
 * Neo4j access. When NEO4J_* keys are missing, callers use the in-memory graph built from the
 * workspace (lib/graph/memoryGraph.ts in P4) and return the same row shape with engine="memory".
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
