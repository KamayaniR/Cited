import "server-only";
import { vendorFetch } from "@/lib/monitor";
import { env, mockFor } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";
import { mockPersonContact, mockCompanyInfo } from "@/lib/seed/fixtures";

const BASE = "https://api.apollo.io/api/v1";
const warned = new Set<string>();
function warnPlan(path: string) { if (!warned.has(path)) { warned.add(path); console.warn(`[apollo] ${path} not in this API plan; fallback skipped`); } }

async function post(path: string, body: Record<string, unknown>) {
  const res = await vendorFetch("apollo", `${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.apolloKey!, "cache-control": "no-cache" },
    body: JSON.stringify(body),
  });
  if (res.status === 403) { warnPlan(path); return {}; } // free plan: endpoint not included, treat as no data
  if (!res.ok) throw new ApiError("VENDOR_ERROR", `Apollo ${path} failed: HTTP ${res.status}`, { vendor: "apollo" });
  return (await res.json()) as Record<string, unknown>;
}

/** Fallback only: called for fields Hunter left empty. */
export async function matchPerson(p: { firstName: string; lastName: string; domain: string }) {
  if (mockFor("apollo")) {
    const m = mockPersonContact(p.domain, p.firstName, p.lastName);
    return { email: m.apolloEmail, linkedinUrl: m.apolloLinkedin, previouslyAt: m.previouslyAt, school: m.school, source: "mock" as const };
  }
  const r = await post("/people/match", { first_name: p.firstName, last_name: p.lastName, domain: p.domain, reveal_personal_emails: false });
  const person = r.person as { email?: string; linkedin_url?: string; employment_history?: { organization_name?: string; current?: boolean }[] } | undefined;
  const previouslyAt = [...new Set((person?.employment_history ?? []).filter((e) => !e.current && e.organization_name).map((e) => e.organization_name!))].slice(0, 5);
  return { email: person?.email ?? null, linkedinUrl: person?.linkedin_url ?? null, previouslyAt, school: null as string | null, source: "apollo" as const };
}

export async function enrichOrg(domain: string) {
  if (mockFor("apollo")) {
    const m = mockCompanyInfo(domain);
    return { hq: m.apolloHq, source: "mock" as const };
  }
  const res = await vendorFetch("apollo", `${BASE}/organizations/enrich?domain=${encodeURIComponent(domain)}`, { headers: { "x-api-key": env.apolloKey! } });
  if (res.status === 403) { warnPlan("/organizations/enrich"); return { hq: null, source: "apollo" as const }; }
  if (!res.ok) throw new ApiError("VENDOR_ERROR", `Apollo org enrich failed: HTTP ${res.status}`, { vendor: "apollo" });
  const org = ((await res.json()) as { organization?: { city?: string; state?: string; country?: string } }).organization;
  const hq = org ? [org.city, org.state, org.country].filter(Boolean).join(", ") || null : null;
  return { hq, source: "apollo" as const };
}
