import "server-only";
import { z } from "zod";
import { completeJson } from "@/lib/providers/llm";
import { search, type SearchResult } from "@/lib/providers/tavily";
import { validateCitations, isReturned, hostOf } from "./citations";
import { fitScore, intentScore, combineScore, tierFor } from "./scoring";
import { SignalTypeEnum, type Icp, type Expansion, type Company, type Signal, type Citation, type Competitor, type ProductInput } from "@/lib/types";
import { DEMO_COMPANIES, DEMO_COMPETITORS } from "@/lib/seed/fixtures";
import { newId, nowIso } from "@/lib/ids";

export const MAX_QUERIES = 6;

// ---------- 1. Query building ----------
/** Up to 6 queries: each ICP industry paired with its strongest triggers, plus accepted expansion segments. */
export function buildQueries(icp: Icp, expansions: Expansion[] = []): string[] {
  const region = icp.regions.value[0] ?? "";
  const triggers = [...icp.triggers].sort((a, b) => b.confidence - a.confidence);
  const industries = [...icp.industries].sort((a, b) => b.confidence - a.confidence);
  const qs: string[] = [];
  for (const ind of industries) {
    for (const t of triggers.slice(0, 2)) qs.push(`${ind.name} company ${t.signal} ${region} news`.trim());
  }
  for (const e of expansions.filter((x) => x.status === "accepted" || x.status === "adjusted")) qs.unshift(`${e.segment} ${triggers[0]?.signal ?? ""}`.trim());
  return [...new Set(qs)].slice(0, MAX_QUERIES);
}

// ---------- 2. Extraction ----------
// Lenient on optional facts (live LLMs leave gaps); strict on what we cite.
export const ProspectSchema = z.object({
  companies: z.array(z.object({
    name: z.string(),
    domain: z.string().nullish().transform((v) => v ?? ""),
    industry: z.string().nullish().transform((v) => v ?? ""),
    naics: z.coerce.string().nullish().transform((v) => v ?? ""),
    headcount: z.coerce.number().nullish().transform((v) => v ?? 0),
    region: z.string().nullish().transform((v) => v ?? ""),
    sourceUrls: z.array(z.string()).min(1),
    signals: z.array(z.object({
      type: z.string().transform((t) => (SignalTypeEnum.options as string[]).includes(t) ? (t as z.infer<typeof SignalTypeEnum>) : "launch"),
      summary: z.string().nullish(),
      sourceUrl: z.string().nullish(),
    })).default([]).transform((xs) => xs.filter((x): x is { type: z.infer<typeof SignalTypeEnum>; summary: string; sourceUrl: string } => Boolean(x.summary && x.sourceUrl))),
  })),
});
type Prospect = z.infer<typeof ProspectSchema>["companies"][number];

function mockExtract(results: SearchResult[]): z.input<typeof ProspectSchema> {
  const byHost = new Map<string, SearchResult[]>();
  for (const r of results) byHost.set(hostOf(r.url), [...(byHost.get(hostOf(r.url)) ?? []), r]);
  const companies: Prospect[] = [];
  for (const [host, rs] of byHost) {
    const dc = DEMO_COMPANIES.find((c) => c.domain === host);
    if (!dc) continue;
    companies.push({
      name: dc.name, domain: dc.domain, industry: dc.industry, naics: dc.naics, headcount: dc.headcount, region: dc.region,
      sourceUrls: rs.map((r) => r.url),
      signals: dc.signals.filter((s) => rs.some((r) => r.url.endsWith(s.path))).map((s) => ({ type: s.type, summary: s.summary, sourceUrl: `https://${dc.domain}${s.path}` })),
    });
  }
  // One deliberately uncited extraction, so the validator visibly drops something in the demo.
  companies.push({ name: "Phantom Ledger Co", domain: "phantom-ledger.example", industry: "Software publishers", naics: "513210", headcount: 300, region: "United States", sourceUrls: ["https://phantom-ledger.example/about"], signals: [] });
  return { companies };
}

// ---------- 3. Negative filter ----------
export function negativeReason(p: { region: string; signals: { type: string; summary: string }[] }, icp: Icp, excludeRegions: string[]): string | null {
  const neg = p.signals.find((s) => s.type === "negative");
  if (neg) return `Negative signal: ${neg.summary}`;
  const text = p.signals.map((s) => s.summary.toLowerCase()).join(" ");
  for (const n of icp.negativeSignals) {
    const key = n.toLowerCase().split(/\s+or\s+|,/)[0].trim();
    if (key.length > 4 && text.includes(key)) return `Negative signal: ${n}`;
  }
  const region = p.region.toLowerCase();
  const excluded = excludeRegions.find((r) => region && r.toLowerCase().includes(region));
  if (excluded) return `Excluded region: ${excluded}`;
  return null;
}

// ---------- 4. Competitor map ----------
const CompetitorSchema = z.object({
  competitors: z.array(z.object({
    name: z.string(), domain: z.string(), category: z.enum(["direct", "adjacent", "status_quo"]),
    positioning: z.string(), pricing: z.string().nullish().transform((v) => v ?? "Not published"), ourAdvantage: z.string(), sourceUrl: z.string(),
  })).transform((xs) => xs.slice(0, 6)),
});

async function mapCompetitors(product: ProductInput) {
  const { results } = await search(`${product.name} ${product.description.split(".")[0]} alternatives competitors pricing`, { maxResults: 8 });
  const res = await completeJson({
    task: "competitors",
    system: "You map a product's competitors from search results. Use only companies that appear in the results; sourceUrl must be one of the result URLs. Include the status quo (doing nothing / spreadsheets) as category status_quo if relevant. At most 6.",
    prompt: `Product:\n${JSON.stringify(product)}\n\nSearch results:\n${JSON.stringify(results.map((r) => ({ url: r.url, title: r.title, content: r.content.slice(0, 500) })))}\n\nReturn {"competitors":[{"name","domain","category","positioning","pricing","ourAdvantage","sourceUrl"}]}`,
    schema: CompetitorSchema,
    mock: () => ({ competitors: DEMO_COMPETITORS.map((c) => ({ ...c, sourceUrl: `https://${c.domain}/` })) }),
  });
  const urls = results.map((r) => r.url);
  const competitors: Competitor[] = [];
  for (const c of res.data.competitors) {
    const src = isReturned(c.sourceUrl, urls);
    if (src) competitors.push({ id: newId("cmp"), ...c, sourceUrl: src });
  }
  return { competitors, tokens: res.tokens, costUsd: res.costUsd };
}

// ---------- Orchestration ----------
export interface DiscoveryOutput {
  queries: string[];
  companies: Company[];
  signals: Signal[];
  citations: Citation[];
  competitors: Competitor[];
  dropped: { name: string; reason: string }[];
  tokens: number;
  costUsd: number;
  mode: "live" | "mock";
}

const QueriesSchema = z.object({ queries: z.array(z.string()).min(1).transform((q) => q.slice(0, MAX_QUERIES)) });

export async function runDiscovery(input: { icp: Icp; expansions: Expansion[]; product: ProductInput; existingDomains?: string[] }): Promise<DiscoveryOutput> {
  const fallback = buildQueries(input.icp, input.expansions);
  const qres = await completeJson({
    task: "discovery_queries",
    system: `Write up to ${MAX_QUERIES} short web search queries (4-9 words each) that find NAMED companies matching this ICP and showing its buying triggers, e.g. news of hires, funding, ERP go-lives. Prefer queries that return company announcements, press releases and job posts. Accepted expansion segments go first.`,
    prompt: `ICP: ${JSON.stringify(input.icp)}\nAccepted expansions: ${JSON.stringify(input.expansions.filter((e) => e.status !== "dismissed" && e.status !== "proposed").map((e) => e.segment))}\nReturn {"queries":["..."]}`,
    schema: QueriesSchema,
    mock: () => ({ queries: fallback }),
  });
  const queries = qres.data.queries;

  // Search, dedupe by URL.
  const seen = new Map<string, SearchResult>();
  for (const q of queries) {
    const { results } = await search(q, { maxResults: 8 });
    for (const r of results) if (!seen.has(r.url)) seen.set(r.url, r);
  }
  const results = [...seen.values()];
  const returnedUrls = results.map((r) => r.url);

  const ext = await completeJson({
    task: "extract_prospects",
    system: `Extract B2B companies that match the ICP from web search results.
Rules: only companies named in the results (not publishers, vendors or consultancies writing the article); sourceUrls and each signal's sourceUrl must be copied exactly from result URLs; never invent a URL.
domain: the company's official website domain as you know it (it is verified by search before use).
Signal type is one of ${SignalTypeEnum.options.join(", ")}; use "negative" for hiring freezes, layoffs, bankruptcy or similar.
Estimate headcount from the text; give a 6-digit NAICS code.`,
    prompt: `ICP:\n${JSON.stringify(input.icp)}\n\nSearch results:\n${JSON.stringify(results.map((r) => ({ url: r.url, title: r.title, content: r.content.slice(0, 600) })))}\n\nReturn exactly this shape, every field filled (use "" or 0 when unknown, but never invent):\n{"companies":[{"name":"","domain":"example.com","industry":"","naics":"000000","headcount":0,"region":"United States","sourceUrls":["<result url>"],"signals":[{"type":"hiring","summary":"","sourceUrl":"<result url>"}]}]}`,
    schema: ProspectSchema,
    mock: () => mockExtract(results),
    maxTokens: 8000,
  });

  const { kept, dropped } = validateCitations(ext.data.companies, returnedUrls);
  const comp = await mapCompetitors(input.product);

  const now = nowIso();
  const companies: Company[] = [];
  const signals: Signal[] = [];
  const citations: Citation[] = [];
  const skip = new Set(input.existingDomains ?? []);

  for (const p of kept) {
    // Domain must come from a cited URL when the model left it blank; never guessed from the name.
    const clean = (d: string) => d.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const claimed = clean(p.domain);
    let finalDomain = p.sourceUrls.map(hostOf).find((h) => claimed && h === claimed) ?? "";
    let domainFromLookup = false;
    if (!finalDomain) {
      // Verify the claimed domain with search: accepted only when search returns a page served from it.
      let hit = "";
      if (claimed) {
        const { results: site } = await search(p.name, { maxResults: 3, includeDomains: [claimed] });
        if (site.some((r) => hostOf(r.url) === claimed || hostOf(r.url).endsWith(`.${claimed}`))) hit = claimed;
      }
      if (hit) { finalDomain = hit; domainFromLookup = true; }
    }
    if (!finalDomain) { dropped.push({ item: p, reason: "No company domain found in cited sources or by search" }); continue; }
    if (skip.has(finalDomain)) continue;
    skip.add(finalDomain);
    const id = newId("co");
    const coSignals: Signal[] = p.signals
      .map((s) => ({ s, src: isReturned(s.sourceUrl, returnedUrls) }))
      .filter((x): x is { s: typeof x.s; src: string } => Boolean(x.src))
      .map(({ s, src }) => ({ id: newId("sig"), companyId: id, type: s.type, summary: s.summary, sourceUrl: src, detectedAt: now }));

    const reason = negativeReason({ region: p.region, signals: coSignals }, input.icp, input.product.excludeRegions);
    const fit = fitScore(input.icp, { ...p, region: p.region });
    const intent = intentScore(input.icp, coSignals);
    const score = combineScore(fit, intent);
    // Domain is trusted only when it appears in one of the cited URLs.
    const domainCited = domainFromLookup || p.sourceUrls.some((u) => hostOf(u) === finalDomain);

    companies.push({
      id, name: p.name, domain: finalDomain, domainSource: domainCited ? "tavily" : "mock", industry: p.industry, naics: p.naics,
      headcount: p.headcount, region: p.region, hq: null, hqSource: null,
      fitScore: fit, intentScore: intent, score, tier: tierFor(score),
      excluded: Boolean(reason), excludeReason: reason, signalsRefreshedAt: now,
    });
    signals.push(...coSignals);
    for (const u of p.sourceUrls) {
      const r = seen.get(u);
      citations.push({ id: newId("cit"), entityType: "company", entityId: id, url: u, title: r?.title ?? u, snippet: r?.content.slice(0, 240) ?? "", fetchedAt: now });
    }
    for (const s of coSignals) {
      const r = seen.get(s.sourceUrl);
      citations.push({ id: newId("cit"), entityType: "signal", entityId: s.id, url: s.sourceUrl, title: r?.title ?? s.summary, snippet: r?.content.slice(0, 240) ?? "", fetchedAt: now });
    }
  }
  for (const c of comp.competitors) citations.push({ id: newId("cit"), entityType: "competitor", entityId: c.id, url: c.sourceUrl, title: c.name, snippet: c.positioning, fetchedAt: now });

  return {
    queries, companies, signals, citations, competitors: comp.competitors,
    dropped: dropped.map((d) => ({ name: d.item.name, reason: d.reason })),
    tokens: ext.tokens + comp.tokens, costUsd: ext.costUsd + comp.costUsd, mode: ext.mode,
  };
}
