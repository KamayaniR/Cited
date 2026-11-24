import "server-only";
import * as hunter from "@/lib/providers/hunter";
import * as apollo from "@/lib/providers/apollo";
import type { Company, Person, Icp, Source, Workspace, Lead } from "@/lib/types";
import { newId, nowIso } from "@/lib/ids";
import { CREDIT_PRICES } from "@/lib/providers/flexprice";

/**
 * Enrichment with fallback (spec Section 4):
 *   email + status  Hunter Finder/Verifier → Apollo People Match (then Hunter Verifier) → unknown
 *   LinkedIn URL    Hunter → Apollo
 *   HQ              Hunter Company → Apollo Org
 * Apollo is only called for fields Hunter left empty. Each field records which step filled it.
 */
export const ENRICH_CREDITS = CREDIT_PRICES.lead_enriched;

const SENIORITY_RANK: Record<string, number> = { c_level: 4, executive: 4, vp: 3.5, director: 3, senior: 2, manager: 2 };

/** Best buyer: persona title match first, then seniority. */
export function pickBuyer(icp: Icp, contacts: hunter.HunterContact[]) {
  let best: { c: hunter.HunterContact; score: number } | null = null;
  for (const c of contacts) {
    const t = c.position.toLowerCase();
    const persona = icp.personas.find((p) => t.includes(p.title.toLowerCase()) || p.title.toLowerCase().split(/\s+/).every((w) => t.includes(w)));
    const score = (persona ? 1 + persona.confidence : 0) + (SENIORITY_RANK[c.seniority] ?? 0) / 2 + (/financ|controller|cfo|accounting/.test(t) ? 0.5 : 0);
    if (!best || score > best.score) best = { c, score };
  }
  return best && best.score > 0.5 ? { contact: best.c, personaMatch: Math.min(1, best.score / 4.5) } : null;
}

export interface EnrichResult {
  person: Person | null;
  hq: string | null;
  hqSource: Source | null;
  calls: { hunter: number; apollo: number };
}

export async function enrichCompany(icp: Icp, company: Company): Promise<EnrichResult> {
  const calls = { hunter: 0, apollo: 0 };

  // HQ
  let hq = company.hq, hqSource = company.hqSource;
  if (!hq) {
    calls.hunter++;
    const h = await hunter.enrichCompany(company.domain);
    if (h.hq) { hq = h.hq; hqSource = "hunter"; }
    else {
      calls.apollo++;
      const a = await apollo.enrichOrg(company.domain);
      if (a.hq) { hq = a.hq; hqSource = "apollo"; }
    }
  }

  // Buyer
  calls.hunter++;
  const { contacts } = await hunter.domainSearch(company.domain);
  const pick = pickBuyer(icp, contacts);
  if (!pick) return { person: null, hq, hqSource, calls };
  const { contact } = pick;

  calls.hunter++;
  const h = await hunter.findAndVerifyEmail(company.domain, contact.firstName, contact.lastName);
  let email = h.email, emailStatus = h.status, mx = h.mx, emailSource: Source | null = h.email ? "hunter" : null;
  let linkedinUrl = h.linkedinUrl, linkedinSource: Source | null = h.linkedinUrl ? "hunter" : null;

  if (!email || emailStatus === "invalid" || !linkedinUrl) {
    calls.apollo++;
    const a = await apollo.matchPerson({ firstName: contact.firstName, lastName: contact.lastName, domain: company.domain });
    if ((!email || emailStatus === "invalid") && a.email && a.email !== email) {
      calls.hunter++;
      const v = await hunter.verifyEmail(a.email);
      if (v.status !== "invalid") { email = a.email; emailStatus = v.status; mx = v.mx; emailSource = "apollo"; }
    }
    if (!linkedinUrl && a.linkedinUrl) { linkedinUrl = a.linkedinUrl; linkedinSource = "apollo"; }
  }
  if (emailStatus === "invalid") { email = null; emailSource = null; }

  return {
    hq, hqSource, calls,
    person: {
      id: newId("per"), companyId: company.id, name: `${contact.firstName} ${contact.lastName}`, title: contact.position, seniority: contact.seniority,
      email, emailStatus: email ? emailStatus : emailStatus === "invalid" ? "invalid" : "unknown", emailSource, mx,
      linkedinUrl, linkedinSource, personaMatch: Number(pick.personaMatch.toFixed(2)),
    },
  };
}

/** Companies that still need enrichment, best score first. */
export function enrichQueue(ws: Workspace, companyIds?: string[]): Company[] {
  const done = new Set(ws.leads.map((l) => l.companyId));
  return ws.companies
    .filter((c) => !c.excluded && !done.has(c.id) && (!companyIds || companyIds.includes(c.id)))
    .sort((a, b) => b.score - a.score);
}

/** Apply one enrichment result: update company HQ, add person, create a Matched lead. */
export function applyEnrichment(ws: Workspace, company: Company, r: EnrichResult): Lead | null {
  const c = ws.companies.find((x) => x.id === company.id)!;
  c.hq = r.hq; c.hqSource = r.hqSource;
  if (!r.person) return null;
  ws.people.push(r.person);
  const variant: "A" | "B" = ws.leads.length % 2 ? "B" : "A";
  const lead: Lead = { id: newId("lead"), companyId: c.id, personId: r.person.id, stage: "matched", outcome: null, owner: "agent", variant };
  ws.leads.push(lead);
  ws.leadEvents.push({ id: newId("lev"), leadId: lead.id, fromStage: null, toStage: "matched", actor: "agent", note: "Passed discovery, citation check and negative filter; enriched", at: nowIso() });
  return lead;
}
