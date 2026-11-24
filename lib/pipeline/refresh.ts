import "server-only";
import { z } from "zod";
import type { Company, Icp, Signal, Tier, Workspace } from "@/lib/types";
import { SignalTypeEnum } from "@/lib/types";
import { getWorkspace, mutate, audit, agentEvent } from "@/lib/db/store";
import { isLive } from "@/lib/env";
import { search } from "@/lib/providers/tavily";
import { completeJson } from "@/lib/providers/llm";
import { CREDIT_PRICES } from "@/lib/providers/flexprice";
import { MOCK_REFRESH_SIGNALS } from "@/lib/seed/fixtures";
import { charge } from "./credits";
import { normalizeUrl } from "./citations";
import { negativeReason } from "./discovery";
import { syncEvidence, matchTriggers } from "./evidence";
import { intentScore, combineScore, tierFor } from "./scoring";
import { mirrorGraph } from "@/lib/graph/run";
import { newId, nowIso } from "@/lib/ids";

/** Most companies one refresh run touches (spec: Tier A/B first, max 50). */
export const MAX_REFRESH = 50;

export interface FreshSignal { type: Signal["type"]; summary: string; url: string; title: string }
export interface TierChange { companyId: string; name: string; from: Tier; to: Tier; score: number }
export interface RefreshResult {
  processed: number; added: number; skippedForCredits: number; filtered: string[];
  tierChanges: TierChange[]; mode: "live" | "mock"; evidence: string; graph: string;
}

const FreshSchema = z.object({
  signals: z.array(z.object({ type: SignalTypeEnum.catch("launch"), summary: z.string().min(3).transform((s) => s.slice(0, 200)), sourceUrl: z.string() })).max(6).default([]),
});

/** Which companies a run covers: the ones asked for, else Tier A/B, oldest refresh first. */
export function refreshQueue(ws: Workspace, companyIds?: string[]): Company[] {
  return ws.companies
    .filter((c) => !c.excluded && (companyIds ? companyIds.includes(c.id) : c.tier !== "C"))
    .sort((a, b) => (a.tier === b.tier ? a.signalsRefreshedAt.localeCompare(b.signalsRefreshedAt) : a.tier.localeCompare(b.tier)))
    .slice(0, MAX_REFRESH);
}

/** New signals for one company. Live: Tavily news search + LLM extraction, URLs must be search results. Mock: fixtures. */
export async function fetchFreshSignals(company: Company, icp: Icp): Promise<{ signals: FreshSignal[]; mode: "live" | "mock" }> {
  // Demo companies live on the reserved .example TLD: never search the web for them (a real
  // company with the same name would be attached to the fictional one).
  if (!isLive("tavily") || !isLive("llm") || company.domain.endsWith(".example")) {
    const fx = MOCK_REFRESH_SIGNALS[company.domain] ?? [];
    return { signals: fx.map((s) => ({ type: s.type, summary: s.summary, url: `https://${company.domain}${s.path}`, title: `${company.name}: ${s.summary}` })), mode: "mock" };
  }
  const { results } = await search(`"${company.name}" news hiring funding CFO acquisition ${company.domain}`, { maxResults: 6 });
  // Same-name companies are common; keep a result only if it is on their site, mentions their domain, or names them in full.
  const relevant = results.filter((r) => {
    const host = new URL(r.url).host.replace(/^www\./, "");
    const text = (r.title + " " + r.content).toLowerCase();
    return host === company.domain || host.endsWith(`.${company.domain}`) || text.includes(company.domain) || text.includes(company.name.toLowerCase());
  });
  if (!relevant.length) return { signals: [], mode: "live" };
  const r = await completeJson({
    task: "refresh_signals",
    system: `List recent buying signals for ONE company from search results. Only events about ${company.name} (${company.domain}, ${company.industry}, ${company.hq ?? company.region}) itself; if a result might be a different company with a similar name, skip it. Summaries are one short sentence. sourceUrl must be copied exactly from a result URL. Signal type is one of ${SignalTypeEnum.options.join(", ")}; "negative" for hiring freezes, layoffs, bankruptcy or similar. ICP triggers to look for: ${icp.triggers.map((t) => t.signal).join("; ")}.`,
    prompt: `Company: ${company.name} (${company.domain})\nResults:\n${JSON.stringify(relevant.map((x) => ({ url: x.url, title: x.title, content: x.content.slice(0, 500) })))}\nReturn {"signals":[{"type":"hiring","summary":"","sourceUrl":"<result url>"}]}`,
    schema: FreshSchema,
    mock: () => ({ signals: [] }),
    maxTokens: 1200,
  });
  const byUrl = new Map(relevant.map((x) => [normalizeUrl(x.url), x]));
  const signals = r.data.signals
    .filter((s) => byUrl.has(normalizeUrl(s.sourceUrl)))
    .map((s) => ({ type: s.type, summary: s.summary, url: byUrl.get(normalizeUrl(s.sourceUrl))!.url, title: byUrl.get(normalizeUrl(s.sourceUrl))!.title }));
  return { signals, mode: "live" };
}

/**
 * Scheduled (cron) and manual refresh. Per company: credit gate → fetch → add only new, cited
 * signals → negative filter. Then Moss re-index, semantic trigger matching, re-score and re-tier,
 * with every tier change and filter in the audit log. Out of credits skips and counts, never fails.
 */
export async function refreshSignals(opts: { companyIds?: string[]; actor: "agent" | "rep"; trigger: "cron" | "manual" }): Promise<RefreshResult> {
  const ws0 = getWorkspace();
  if (!ws0.icp) return { processed: 0, added: 0, skippedForCredits: 0, filtered: [], tierChanges: [], mode: "mock", evidence: "skipped", graph: "skipped" };
  const icp = ws0.icp.data;
  const queue = refreshQueue(ws0, opts.companyIds);
  const touched: string[] = [];
  const filtered: string[] = [];
  let added = 0, skippedForCredits = 0;
  let mode: "live" | "mock" = "mock";

  for (const target of queue) {
    if (getWorkspace().org.creditsBalance < CREDIT_PRICES.signal_refresh) { skippedForCredits++; continue; }
    const fresh = await fetchFreshSignals(target, icp);
    mode = fresh.mode;
    mutate((ws) => {
      const c = ws.companies.find((x) => x.id === target.id);
      if (!c) return;
      charge(ws, "signal_refresh", null);
      c.signalsRefreshedAt = nowIso();
      touched.push(c.id);
      const known = new Set(ws.signals.filter((s) => s.companyId === c.id).map((s) => normalizeUrl(s.sourceUrl)));
      const newOnes: Signal[] = [];
      for (const f of fresh.signals) {
        if (known.has(normalizeUrl(f.url))) continue;
        known.add(normalizeUrl(f.url));
        const sig: Signal = { id: newId("sig"), companyId: c.id, type: f.type, summary: f.summary, sourceUrl: f.url, detectedAt: nowIso() };
        ws.signals.push(sig);
        ws.citations.push({ id: newId("cit"), entityType: "signal", entityId: sig.id, url: f.url, title: f.title, snippet: f.summary, fetchedAt: nowIso() });
        newOnes.push(sig);
      }
      added += newOnes.length;
      if (newOnes.length) audit(ws, { actor: opts.actor, agent: "builder", action: "signals_added", target: c.id, detail: `${c.name}: ${newOnes.map((s) => s.summary).join("; ")}` });
      const neg = negativeReason({ region: "", signals: newOnes }, icp, []);
      if (neg) {
        c.excluded = true; c.excludeReason = neg;
        filtered.push(c.id);
        audit(ws, { actor: "agent", agent: "builder", action: "company_filtered", target: c.id, detail: `${c.name}: ${neg} (found by ${opts.trigger} refresh)` });
        for (const l of ws.leads.filter((x) => x.companyId === c.id)) {
          for (const m of ws.messages.filter((x) => x.leadId === l.id && (x.status === "pending_approval" || x.status === "approved" || x.status === "needs_fix" || x.status === "draft"))) {
            m.status = "rejected";
            m.review = { ...(m.review ?? {}), notes: [...(m.review?.notes ?? []), `Withdrawn: ${neg}`] };
          }
          audit(ws, { actor: "agent", agent: "builder", action: "lead_filtered", target: l.id, detail: `${c.name}: unsent drafts withdrawn (${neg})` });
        }
      }
    });
  }

  // Moss: index the new evidence, then match ICP triggers by meaning and re-score.
  const indexed = await syncEvidence(getWorkspace());
  const tm = await matchTriggers(icp.triggers.map((t) => t.signal));
  const tierChanges: TierChange[] = [];
  mutate((ws) => {
    for (const c of ws.companies.filter((x) => touched.includes(x.id))) {
      const before = c.tier;
      c.intentScore = intentScore(icp, ws.signals.filter((s) => s.companyId === c.id), new Date(), (s) => Boolean(s.id && tm.matches.has(s.id)));
      c.score = combineScore(c.fitScore, c.intentScore);
      c.tier = tierFor(c.score);
      if (c.tier !== before) {
        tierChanges.push({ companyId: c.id, name: c.name, from: before, to: c.tier, score: c.score });
        audit(ws, { actor: "agent", agent: "builder", action: "tier_changed", target: c.id, detail: `${c.name}: Tier ${before} → Tier ${c.tier} (score ${c.score})` });
      }
    }
    agentEvent(ws, {
      from: "builder", to: "planner", kind: "result",
      text: `Signal refresh (${opts.trigger}): ${touched.length} companies, ${added} new signals, ${tierChanges.length} tier changes, ${filtered.length} filtered, ${skippedForCredits} skipped for credits; Moss indexed ${indexed.count}`,
    });
    audit(ws, { actor: opts.actor, agent: opts.trigger === "cron" ? "cron" : "ui", action: "signals_refreshed", target: ws.org.id, detail: `${touched.length} companies, ${added} new signals, ${tierChanges.length} tier changes` });
  });
  const graph = await mirrorGraph(getWorkspace());
  return { processed: touched.length, added, skippedForCredits, filtered, tierChanges, mode, evidence: `${indexed.count} (${indexed.mode})`, graph };
}
