import type { Workspace } from "@/lib/types";

/**
 * The knowledge graph, derived from the workspace records. Node ids match the record ids, so the
 * graph and the records never drift. The same structure is MERGEd into Neo4j when it's configured,
 * and queried in memory when it isn't.
 */
export type NodeLabel = "Company" | "Person" | "Product" | "Competitor" | "Signal" | "Team" | "School";
export type EdgeType =
  | "works_at" | "competes_with" | "matched_to" | "contacted_via" | "replied_to"
  | "previously_employed_at" | "has_signal" | "uses" | "studied_at";

export interface GNode { id: string; label: NodeLabel; props: Record<string, string | number | boolean | null> }
export interface GEdge { type: EdgeType; from: string; to: string; props: Record<string, string | number | boolean | null> }
export interface Graph { nodes: Map<string, GNode>; edges: GEdge[] }

export const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Same employer spelled two ways ("Stratus Data, Inc." vs "Stratus Data") should be one node. */
export const orgKey = (name: string) => slug(name.replace(/,?\s+(inc|llc|ltd|corp|co|gmbh)\.?$/i, ""));

export function buildGraph(ws: Workspace): Graph {
  const nodes = new Map<string, GNode>();
  const edges: GEdge[] = [];
  const node = (n: GNode) => { if (!nodes.has(n.id)) nodes.set(n.id, n); return n.id; };
  const edge = (type: EdgeType, from: string, to: string, props: GEdge["props"] = {}) => edges.push({ type, from, to, props });

  // Companies we track, plus "external" employer nodes that only exist as someone's past job.
  const companyByKey = new Map<string, string>();
  for (const c of ws.companies) {
    node({ id: c.id, label: "Company", props: { name: c.name, domain: c.domain, industry: c.industry, tier: c.tier, score: c.score, excluded: c.excluded } });
    companyByKey.set(orgKey(c.name), c.id);
  }
  const employer = (name: string) => {
    const k = orgKey(name);
    const id = companyByKey.get(k) ?? `org_${k}`;
    return node({ id, label: "Company", props: { name, domain: null, industry: null, tier: null, score: null, excluded: false } });
  };
  const school = (name: string) => node({ id: `sch_${slug(name)}`, label: "School", props: { name } });

  if (ws.product) {
    node({ id: ws.product.id, label: "Product", props: { name: ws.product.name } });
  }
  for (const t of ws.team) {
    node({ id: t.id, label: "Team", props: { name: t.name, role: t.role } });
    for (const p of t.previouslyAt) edge("previously_employed_at", t.id, employer(p));
    if (t.school) edge("studied_at", t.id, school(t.school));
  }

  for (const cmp of ws.competitors) {
    node({ id: cmp.id, label: "Competitor", props: { name: cmp.name, domain: cmp.domain, category: cmp.category, ourAdvantage: cmp.ourAdvantage } });
    if (ws.product) edge("competes_with", ws.product.id, cmp.id);
  }

  for (const s of ws.signals) {
    node({ id: s.id, label: "Signal", props: { type: s.type, summary: s.summary, url: s.sourceUrl, detectedAt: s.detectedAt } });
    edge("has_signal", s.companyId, s.id);
    // A signal that names a competitor (not the status quo) means the company uses it.
    for (const cmp of ws.competitors) {
      if (cmp.category !== "status_quo" && new RegExp(`\\b${cmp.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(s.summary)) {
        edge("uses", s.companyId, cmp.id, { signalId: s.id, renewal: /renew/i.test(s.summary) });
      }
    }
  }

  for (const p of ws.people) {
    node({ id: p.id, label: "Person", props: { name: p.name, title: p.title, seniority: p.seniority, personaMatch: p.personaMatch } });
    edge("works_at", p.id, p.companyId);
    for (const prev of p.previouslyAt ?? []) edge("previously_employed_at", p.id, employer(prev));
    if (p.school) edge("studied_at", p.id, school(p.school));
  }

  for (const l of ws.leads) {
    if (ws.product) edge("matched_to", l.personId, ws.product.id, { leadId: l.id, stage: l.stage });
    for (const m of ws.messages.filter((x) => x.leadId === l.id && x.status === "sent")) if (ws.product) edge("contacted_via", l.personId, ws.product.id, { leadId: l.id, messageId: m.id, channel: m.channel, step: m.step });
    if (ws.leadEvents.some((e) => e.leadId === l.id && e.toStage === "replied") && ws.product) edge("replied_to", l.personId, ws.product.id, { leadId: l.id });
  }

  return { nodes, edges };
}

export function graphStats(g: Graph) {
  const nodes: Record<string, number> = {};
  const edges: Record<string, number> = {};
  for (const n of g.nodes.values()) nodes[n.label] = (nodes[n.label] ?? 0) + 1;
  for (const e of g.edges) edges[e.type] = (edges[e.type] ?? 0) + 1;
  return { nodes, edges, nodeCount: g.nodes.size, edgeCount: g.edges.length };
}
