import type { Workspace } from "@/lib/types";
import { buildGraph, type Graph, type GNode } from "./model";

/**
 * The three multi-hop queries (spec P4). Each has the Cypher that runs on Neo4j and an in-memory
 * implementation over the same graph with the same row shape, so mock mode and live mode match.
 */
export type QueryKey = "warm" | "hiring" | "displacement";

export interface WarmRow { team: string; teamRole: string; via: string; viaLabel: "Company" | "School"; person: string; title: string; company: string; companyId: string; tier: string; isBuyer: boolean }
export interface HiringRow { company: string; companyId: string; tier: string; hiring: string; hiringUrl: string; evaluation: string[]; buyer: string | null; buyerTitle: string | null }
export interface DisplacementRow { company: string; companyId: string; tier: string; competitor: string; renewal: boolean; evidence: string; evidenceUrl: string; angle: string; buyer: string | null; buyerTitle: string | null }
export type Row = WarmRow | HiringRow | DisplacementRow;

export const QUERY_INFO: Record<QueryKey, { title: string; question: string }> = {
  warm: { title: "Warm paths", question: "Who on our team shares a past employer or school with someone at a target company?" },
  hiring: { title: "Hiring → evaluation", question: "Which targets are hiring finance staff while also showing an evaluation trigger (new system, funding, new leader, expansion)?" },
  displacement: { title: "Competitor displacement", question: "Which targets use a competitor we beat, and is a renewal coming up?" },
};

export const CYPHER: Record<QueryKey, string> = {
  warm: `MATCH (t:Team)-[r1:previously_employed_at|studied_at]->(x)<-[r2]-(p:Person)-[:works_at]->(c:Company)
WHERE type(r1) = type(r2) AND c.excluded = false AND c.org = $org
OPTIONAL MATCH (p)-[m:matched_to]->(:Product)
RETURN t.name AS team, t.role AS teamRole, x.name AS via, labels(x)[0] AS viaLabel,
       p.name AS person, p.title AS title, c.name AS company, c.id AS companyId, c.tier AS tier,
       m IS NOT NULL AS isBuyer
ORDER BY isBuyer DESC, c.score DESC`,
  hiring: `MATCH (c:Company)-[:has_signal]->(h:Signal {type: 'hiring'})
WHERE c.excluded = false AND c.org = $org
MATCH (c)-[:has_signal]->(e:Signal)
WHERE e.type IN ['tech_adoption', 'funding', 'leadership_change', 'expansion']
OPTIONAL MATCH (p:Person)-[:works_at]->(c), (p)-[:matched_to]->(:Product)
RETURN c.name AS company, c.id AS companyId, c.tier AS tier, h.summary AS hiring, h.url AS hiringUrl,
       collect(DISTINCT e.summary) AS evaluation, p.name AS buyer, p.title AS buyerTitle
ORDER BY c.score DESC`,
  displacement: `MATCH (:Product)-[:competes_with]->(k:Competitor)<-[u:uses]-(c:Company)
WHERE c.excluded = false AND c.org = $org
MATCH (c)-[:has_signal]->(s:Signal {id: u.signalId})
OPTIONAL MATCH (p:Person)-[:works_at]->(c), (p)-[:matched_to]->(:Product)
RETURN c.name AS company, c.id AS companyId, c.tier AS tier, k.name AS competitor, u.renewal AS renewal,
       s.summary AS evidence, s.url AS evidenceUrl, k.ourAdvantage AS angle, p.name AS buyer, p.title AS buyerTitle
ORDER BY renewal DESC, c.score DESC`,
};

const str = (n: GNode | undefined, k: string) => (n?.props[k] ?? "") as string;
const num = (n: GNode | undefined, k: string) => Number(n?.props[k] ?? 0);

/** The person at a company with a matched_to edge (the lead's buyer), if any. */
function buyerAt(g: Graph, companyId: string): GNode | undefined {
  const people = g.edges.filter((e) => e.type === "works_at" && e.to === companyId).map((e) => e.from);
  const id = people.find((p) => g.edges.some((e) => e.type === "matched_to" && e.from === p));
  return id ? g.nodes.get(id) : undefined;
}
const live = (g: Graph, id: string) => { const c = g.nodes.get(id); return c?.label === "Company" && c.props.excluded === false && c.props.domain !== null; };
const byScore = (g: Graph) => (a: { companyId: string }, b: { companyId: string }) => num(g.nodes.get(b.companyId), "score") - num(g.nodes.get(a.companyId), "score");

export function runMemory(g: Graph, q: QueryKey): Row[] {
  if (q === "warm") {
    const rows: WarmRow[] = [];
    for (const r1 of g.edges.filter((e) => (e.type === "previously_employed_at" || e.type === "studied_at") && g.nodes.get(e.from)?.label === "Team")) {
      for (const r2 of g.edges.filter((e) => e.type === r1.type && e.to === r1.to && g.nodes.get(e.from)?.label === "Person")) {
        for (const w of g.edges.filter((e) => e.type === "works_at" && e.from === r2.from && live(g, e.to))) {
          const t = g.nodes.get(r1.from), x = g.nodes.get(r1.to), p = g.nodes.get(r2.from), c = g.nodes.get(w.to);
          rows.push({
            team: str(t, "name"), teamRole: str(t, "role"), via: str(x, "name"), viaLabel: x!.label as "Company" | "School",
            person: str(p, "name"), title: str(p, "title"), company: str(c, "name"), companyId: w.to, tier: str(c, "tier"),
            isBuyer: g.edges.some((e) => e.type === "matched_to" && e.from === r2.from),
          });
        }
      }
    }
    return rows.sort((a, b) => Number(b.isBuyer) - Number(a.isBuyer) || byScore(g)(a, b));
  }

  if (q === "hiring") {
    const rows: HiringRow[] = [];
    for (const [id, c] of g.nodes) {
      if (!live(g, id)) continue;
      const sigs = g.edges.filter((e) => e.type === "has_signal" && e.from === id).map((e) => g.nodes.get(e.to)!);
      const evaluation = [...new Set(sigs.filter((s) => ["tech_adoption", "funding", "leadership_change", "expansion"].includes(str(s, "type"))).map((s) => str(s, "summary")))];
      if (!evaluation.length) continue;
      const b = buyerAt(g, id);
      for (const h of sigs.filter((s) => str(s, "type") === "hiring")) {
        rows.push({ company: str(c, "name"), companyId: id, tier: str(c, "tier"), hiring: str(h, "summary"), hiringUrl: str(h, "url"), evaluation, buyer: b ? str(b, "name") : null, buyerTitle: b ? str(b, "title") : null });
      }
    }
    return rows.sort(byScore(g));
  }

  const rows: DisplacementRow[] = [];
  for (const u of g.edges.filter((e) => e.type === "uses" && live(g, e.from))) {
    if (!g.edges.some((e) => e.type === "competes_with" && e.to === u.to)) continue;
    const c = g.nodes.get(u.from), k = g.nodes.get(u.to), s = g.nodes.get(String(u.props.signalId));
    if (!s) continue;
    const b = buyerAt(g, u.from);
    rows.push({
      company: str(c, "name"), companyId: u.from, tier: str(c, "tier"), competitor: str(k, "name"), renewal: Boolean(u.props.renewal),
      evidence: str(s, "summary"), evidenceUrl: str(s, "url"), angle: str(k, "ourAdvantage"), buyer: b ? str(b, "name") : null, buyerTitle: b ? str(b, "title") : null,
    });
  }
  return rows.sort((a, b) => Number(b.renewal) - Number(a.renewal) || byScore(g)(a, b));
}

export function queryMemory(ws: Workspace, q: QueryKey): Row[] {
  return runMemory(buildGraph(ws), q);
}
