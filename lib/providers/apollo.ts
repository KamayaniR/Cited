import "server-only";
import { env, isLive } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";
import { mockPersonContact, mockCompanyInfo } from "@/lib/seed/fixtures";

const BASE = "https://api.apollo.io/api/v1";

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": env.apolloKey!, "cache-control": "no-cache" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError("VENDOR_ERROR", `Apollo ${path} failed: HTTP ${res.status}`, { vendor: "apollo" });
  return (await res.json()) as Record<string, unknown>;
}

/** Fallback only: called for fields Hunter left empty. */
export async function matchPerson(p: { firstName: string; lastName: string; domain: string }) {
  if (!isLive("apollo")) {
    const m = mockPersonContact(p.domain, p.firstName, p.lastName);
    return { email: m.apolloEmail, linkedinUrl: m.apolloLinkedin, source: "mock" as const };
  }
  const r = await post("/people/match", { first_name: p.firstName, last_name: p.lastName, domain: p.domain, reveal_personal_emails: false });
  const person = r.person as { email?: string; linkedin_url?: string } | undefined;
  return { email: person?.email ?? null, linkedinUrl: person?.linkedin_url ?? null, source: "apollo" as const };
}

export async function enrichOrg(domain: string) {
  if (!isLive("apollo")) {
    const m = mockCompanyInfo(domain);
    return { hq: m.apolloHq, source: "mock" as const };
  }
  const res = await fetch(`${BASE}/organizations/enrich?domain=${encodeURIComponent(domain)}`, { headers: { "x-api-key": env.apolloKey! } });
  if (!res.ok) throw new ApiError("VENDOR_ERROR", `Apollo org enrich failed: HTTP ${res.status}`, { vendor: "apollo" });
  const org = ((await res.json()) as { organization?: { city?: string; state?: string; country?: string } }).organization;
  const hq = org ? [org.city, org.state, org.country].filter(Boolean).join(", ") || null : null;
  return { hq, source: "apollo" as const };
}
