import "server-only";
import type { Workspace, Company } from "@/lib/types";
import { indexEvidence, searchEvidence, SUPPORT_THRESHOLD, type EvidenceDoc } from "@/lib/providers/moss";

/** Everything Cited can cite, as Moss documents. Ids are stable so re-indexing upserts. */
export function evidenceDocs(ws: Workspace): EvidenceDoc[] {
  const docs: EvidenceDoc[] = [];
  const companyOf = (c: { entityType: string; entityId: string }) => {
    if (c.entityType === "company") return c.entityId;
    if (c.entityType === "signal") return ws.signals.find((s) => s.id === c.entityId)?.companyId ?? "unknown";
    return c.entityType === "competitor" ? "competitors" : "market";
  };
  for (const c of ws.citations) {
    docs.push({
      id: c.id, text: `${c.title}. ${c.snippet}`.trim(),
      metadata: { companyId: companyOf(c), entityType: c.entityType, url: c.url, title: c.title, entityId: c.entityId },
    });
  }
  for (const s of ws.signals) {
    const company = ws.companies.find((c) => c.id === s.companyId);
    docs.push({
      id: `ev_${s.id}`, text: `${company?.name ?? ""}: ${s.summary}`,
      metadata: { companyId: s.companyId, entityType: "signal", url: s.sourceUrl, title: s.summary, entityId: s.id },
    });
  }
  for (const c of ws.companies) {
    docs.push({
      id: `ev_${c.id}`, text: `${c.name} (${c.domain}) is a ${c.industry} company with about ${c.headcount} employees in ${c.region}${c.hq ? `, headquartered in ${c.hq}` : ""}.`,
      metadata: { companyId: c.id, entityType: "firmographics", url: `https://${c.domain}`, title: `${c.name} profile`, entityId: c.id },
    });
  }
  if (ws.product) {
    const p = ws.product;
    docs.push({
      id: `ev_${p.id}`, text: `${p.name}: ${p.description} Customers: ${p.customers}. Pricing: ${p.pricing}. ${p.constraints} Team: ${p.teamBackground}`,
      metadata: { companyId: "self", entityType: "product", url: "", title: `${p.name} product description`, entityId: p.id },
    });
  }
  return docs;
}

export async function syncEvidence(ws: Workspace) {
  return indexEvidence(evidenceDocs(ws));
}

/** Top evidence for one lead, used to ground drafting. */
export async function evidenceForCompany(company: Company, query: string, topK = 5) {
  return searchEvidence(query, { companyId: company.id, topK });
}

// ---------------- claim check ----------------
export interface Grounding { sentence: string; supported: boolean; score: number; evidenceId: string | null; url: string | null; title: string | null }
export interface ClaimCheck { claims: Grounding[]; unsupported: string[]; ms: number; engine: string }

/** Split copy into sentences, skipping greetings, sign-offs and questions (the CTA). */
export function sentences(body: string): string[] {
  return body
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[.!])\s+(?=[A-Z])/))
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^(hi|hello|hey|dear)\b.*[,!]?$/i.test(s) && !s.endsWith("?") && s.split(/\s+/).length > 3);
}

/**
 * A specific claim names the company, the product, a number, or another proper noun.
 * Generic statements ("Happy to connect") are opinions, not claims, and aren't checked.
 */
export function isSpecificClaim(s: string, names: string[]): boolean {
  const lower = s.toLowerCase();
  if (names.some((n) => n && lower.includes(n.toLowerCase()))) return true;
  if (/\d/.test(s)) return true;
  const words = s.split(/\s+/).slice(1); // ignore the capital at sentence start
  return words.some((w) => /^[A-Z][a-zA-Z]{2,}/.test(w) && !/^(I|I'm|I've)$/.test(w));
}

/**
 * Hard facts that similarity search can't tell apart: funding rounds, money amounts, percentages and
 * years. Plain counts ("a 20 minute call") are left to the similarity check.
 */
export function hardFacts(s: string): string[] {
  const out = new Set<string>();
  for (const m of s.matchAll(/\bseries\s+([a-h])\b/gi)) out.add(`series ${m[1].toLowerCase()}`);
  for (const m of s.matchAll(/\b(ipo|seed round|pre-seed)\b/gi)) out.add(m[1].toLowerCase());
  for (const m of s.matchAll(/[$€£]\s?\d[\d,.]*\s?(?:[mkb]n?|million|billion)?\b/gi)) out.add(normMoney(m[0]));
  for (const m of s.matchAll(/\b\d+(?:\.\d+)?\s?%/g)) out.add(m[0].replace(/\s/g, ""));
  for (const m of s.matchAll(/\b(19|20)\d{2}\b/g)) out.add(m[0]);
  return [...out];
}

function normMoney(x: string) {
  return x.toLowerCase().replace(/[\s,]/g, "").replace(/million$/, "m").replace(/billion$/, "b").replace(/bn$/, "b");
}

export function factsIn(facts: string[], evidence: string): boolean {
  if (!facts.length) return true;
  const have = new Set(hardFacts(evidence));
  return facts.every((f) => have.has(f));
}

/** @reviewer's claim check: every specific claim must match evidence for this company (or our own product docs). */
export async function claimCheck(text: string, ctx: { companyId: string; companyName: string; productName: string }): Promise<ClaimCheck> {
  const claims: Grounding[] = [];
  let ms = 0, engine = "moss";
  for (const s of sentences(text).filter((x) => isSpecificClaim(x, [ctx.companyName, ctx.productName]))) {
    const r = await searchEvidence(s, { companyId: ctx.companyId, includeSelf: true, topK: 3 });
    ms += r.ms; engine = r.engine;
    // Similar is not the same: "Series D" scores close to evidence about a Series C. The best hit
    // above the threshold must also contain every hard fact in the sentence.
    const facts = hardFacts(s);
    const top = r.hits.find((h) => h.score >= SUPPORT_THRESHOLD && factsIn(facts, h.text)) ?? r.hits[0];
    const supported = Boolean(top && top.score >= SUPPORT_THRESHOLD && factsIn(facts, top.text));
    claims.push({ sentence: s, supported, score: Number((top?.score ?? 0).toFixed(2)), evidenceId: top?.id ?? null, url: top?.metadata.url || null, title: top?.metadata.title ?? null });
  }
  return { claims, unsupported: claims.filter((c) => !c.supported).map((c) => c.sentence), ms: Number(ms.toFixed(2)), engine };
}

/**
 * Semantic trigger matching: each ICP trigger is searched against signal evidence in Moss.
 * Returns signal id → the trigger it matched (replaces word-overlap matching in intent scoring).
 */
export async function matchTriggers(triggers: string[]): Promise<{ matches: Map<string, string>; ms: number }> {
  const matches = new Map<string, string>();
  let ms = 0;
  for (const t of triggers) {
    const r = await searchEvidence(t, { entityType: "signal", topK: 10 });
    ms += r.ms;
    for (const h of r.hits) if (h.score >= SUPPORT_THRESHOLD && !matches.has(h.metadata.entityId)) matches.set(h.metadata.entityId, t);
  }
  return { matches, ms: Number(ms.toFixed(2)) };
}
