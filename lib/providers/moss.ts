import "server-only";
import { env, isLive } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";

/**
 * Moss: Cited's evidence memory.
 * Every page search returned (company pages, signals, competitor pages) and the product description are
 * indexed with metadata. Agents query it in-process (sub-10 ms once loaded) to ground drafts, to check
 * every claim before a human sees it, and to answer the rep's questions in the approval queue.
 *
 * Mock mode keeps the same API with an in-memory hybrid (TF-IDF cosine + keyword) index.
 */
export interface EvidenceDoc {
  id: string;
  text: string;
  metadata: { companyId: string; entityType: string; url: string; title: string; entityId: string };
}
export interface EvidenceHit { id: string; text: string; score: number; metadata: EvidenceDoc["metadata"] }
export interface EvidenceSearch { hits: EvidenceHit[]; ms: number; mode: "live" | "mock"; engine: "moss" | "moss-mock" }

/** A claim counts as supported when its best evidence scores at or above this (vector similarity 0–1). */
export const SUPPORT_THRESHOLD = 0.45;

// ---------------- live ----------------
type MossClientT = import("@moss-js/moss").MossClient;
const g = globalThis as unknown as { __moss?: MossClientT; __mossLoaded?: boolean; __mossMock?: Map<string, EvidenceDoc> };

async function client(): Promise<MossClientT> {
  if (g.__moss) return g.__moss;
  const { MossClient } = await import("@moss-js/moss");
  g.__moss = new MossClient(env.mossProjectId!, env.mossProjectKey!);
  return g.__moss;
}

async function ensureLoaded(force = false) {
  if (g.__mossLoaded && !force) return;
  const c = await client();
  await c.loadIndex(env.mossIndex);
  g.__mossLoaded = true;
}

/** Upsert evidence into the index (creates it on first use) and reload it in-process. */
export async function indexEvidence(docs: EvidenceDoc[]): Promise<{ count: number; mode: "live" | "mock"; ms: number }> {
  const t0 = performance.now();
  if (!docs.length) return { count: 0, mode: isLive("moss") ? "live" : "mock", ms: 0 };
  if (!isLive("moss")) {
    const store = (g.__mossMock ??= new Map());
    for (const d of docs) store.set(d.id, d);
    return { count: docs.length, mode: "mock", ms: performance.now() - t0 };
  }
  try {
    const c = await client();
    const payload = docs.map((d) => ({ id: d.id, text: d.text.slice(0, 4000), metadata: { ...d.metadata } }));
    let exists = true;
    try { await c.getIndex(env.mossIndex); } catch { exists = false; }
    if (exists) await c.addDocs(env.mossIndex, payload, { upsert: true });
    else await c.createIndex(env.mossIndex, payload);
    await ensureLoaded(true);
    return { count: docs.length, mode: "live", ms: performance.now() - t0 };
  } catch (e) {
    throw new ApiError("VENDOR_ERROR", `Moss indexing failed: ${(e as Error).message}`, { vendor: "moss" });
  }
}

/** Hybrid search over evidence, optionally scoped to one company (plus the product's own docs via `includeSelf`). */
export async function searchEvidence(query: string, opts: { companyId?: string; includeSelf?: boolean; topK?: number; alpha?: number; entityType?: string } = {}): Promise<EvidenceSearch> {
  const topK = opts.topK ?? 5;
  const scopes = opts.companyId ? [opts.companyId, ...(opts.includeSelf ? ["self"] : [])] : [undefined];
  if (!isLive("moss")) {
    const t0 = performance.now();
    const hits = scopes.flatMap((s) => mockQuery(query, { companyId: s, entityType: opts.entityType, topK }));
    return { hits: dedupeTop(hits, topK), ms: performance.now() - t0, mode: "mock", engine: "moss-mock" };
  }
  try {
    await ensureLoaded();
    const c = await client();
    const t0 = performance.now();
    const results = await Promise.all(scopes.map((s) => {
      const conds = [
        ...(s ? [{ field: "companyId", condition: { $eq: s } }] : []),
        ...(opts.entityType ? [{ field: "entityType", condition: { $eq: opts.entityType } }] : []),
      ];
      return c.query(env.mossIndex, query, {
        topK, alpha: opts.alpha ?? 0.7,
        ...(conds.length ? { filter: conds.length === 1 ? conds[0] : { $and: conds } } : {}),
      });
    }));
    const wall = performance.now() - t0;
    const engineMs = results.reduce((s, r) => s + (r.timeTakenInMs ?? 0), 0);
    const hits = results.flatMap((r) => r.docs.map((d) => ({ id: d.id, text: d.text, score: d.score, metadata: d.metadata as EvidenceDoc["metadata"] })));
    return { hits: dedupeTop(hits, topK), ms: engineMs || wall, mode: "live", engine: "moss" };
  } catch (e) {
    throw new ApiError("VENDOR_ERROR", `Moss query failed: ${(e as Error).message}`, { vendor: "moss" });
  }
}

export function resetMockIndex() { g.__mossMock = new Map(); }

function dedupeTop(hits: EvidenceHit[], k: number) {
  const seen = new Map<string, EvidenceHit>();
  for (const h of hits) if (!seen.has(h.id) || seen.get(h.id)!.score < h.score) seen.set(h.id, h);
  return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, k);
}

// ---------------- mock engine ----------------
// Tiny synonym table so the mock behaves a little like an embedding model in the demo.
const SYNONYMS: Record<string, string[]> = {
  erp: ["netsuite", "sage", "intacct", "quickbooks"], netsuite: ["erp"], quickbooks: ["erp", "accounting"],
  hiring: ["hire", "jobs", "careers", "recruiting", "engineers", "accountant"], hire: ["hiring"],
  funding: ["raised", "series", "investment", "round"], raised: ["funding"], series: ["funding"],
  cfo: ["finance", "chief", "financial"], finance: ["accounting", "cfo", "controller"],
  acquisition: ["acquired", "merger", "entities"], acquired: ["acquisition"], expansion: ["expand", "uk", "stores", "opened"],
  close: ["month-end", "reconcile", "reconciliations"], freeze: ["layoffs", "cost"],
};
const STOP = new Set("the a an and or of to in on for with at by from is are was were be this that it its as our your you we they their have has had will can".split(" "));
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9$\s-]/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));
const expand = (ws: string[]) => ws.flatMap((w) => [w, ...(SYNONYMS[w] ?? [])]);

function vec(ws: string[]) { const m = new Map<string, number>(); for (const w of ws) m.set(w, (m.get(w) ?? 0) + 1); return m; }
function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; const bv = b.get(k); if (bv) dot += v * bv; }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function mockQuery(q: string, f: { companyId?: string; entityType?: string; topK: number }): EvidenceHit[] {
  const docs = [...(g.__mossMock?.values() ?? [])].filter((d) => (!f.companyId || d.metadata.companyId === f.companyId) && (!f.entityType || d.metadata.entityType === f.entityType));
  const qt = tokens(q);
  const qv = vec(expand(qt));
  return docs
    .map((d) => {
      const dt = tokens(d.text);
      const sem = cosine(qv, vec(expand(dt)));
      const kw = qt.length ? qt.filter((w) => dt.includes(w)).length / qt.length : 0;
      return { id: d.id, text: d.text, metadata: d.metadata, score: Math.min(1, 0.6 * sem + 0.4 * kw + (sem > 0 ? 0.15 : 0)) };
    })
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, f.topK);
}
