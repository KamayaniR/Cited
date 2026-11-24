import "server-only";
import { env, isLive } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";
import { mockPersonContact, mockCompanyInfo } from "@/lib/seed/fixtures";

const BASE = "https://api.hunter.io/v2";
type Status = "valid" | "accept_all" | "invalid" | "unknown";

export interface HunterEmail { email: string | null; status: Status; mx: boolean; linkedinUrl: string | null; source: "hunter" | "mock" }
export interface HunterCompany { domain: string | null; hq: string | null; source: "hunter" | "mock" }

async function get(path: string, params: Record<string, string>) {
  const qs = new URLSearchParams({ ...params, api_key: env.hunterKey! });
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError("VENDOR_ERROR", `Hunter ${path} failed: HTTP ${res.status}`, { vendor: "hunter" });
  return ((await res.json()) as { data: Record<string, unknown> }).data;
}

/** Email Finder + Email Verifier (status and MX). */
export async function findAndVerifyEmail(domain: string, firstName: string, lastName: string): Promise<HunterEmail> {
  if (!isLive("hunter")) {
    const m = mockPersonContact(domain, firstName, lastName);
    return { email: m.hunterEmail, status: m.hunterStatus, mx: m.hunterEmail !== null, linkedinUrl: m.hunterLinkedin, source: "mock" };
  }
  const found = await get("/email-finder", { domain, first_name: firstName, last_name: lastName });
  const email = (found?.email as string) ?? null;
  const linkedinUrl = (found?.linkedin_url as string) ?? null;
  if (!email) return { email: null, status: "unknown", mx: false, linkedinUrl, source: "hunter" };
  return { ...(await verifyEmail(email)), linkedinUrl };
}

export async function verifyEmail(email: string): Promise<HunterEmail> {
  if (!isLive("hunter")) return { email, status: "valid", mx: true, linkedinUrl: null, source: "mock" };
  const v = await get("/email-verifier", { email });
  const raw = (v?.status as string) ?? "unknown";
  const status: Status = raw === "valid" ? "valid" : raw === "accept_all" ? "accept_all" : raw === "invalid" ? "invalid" : "unknown";
  return { email, status, mx: Boolean(v?.mx_records), linkedinUrl: null, source: "hunter" };
}

/** Company Enrichment by domain: HQ location. */
export async function enrichCompany(domain: string): Promise<HunterCompany> {
  if (!isLive("hunter")) {
    const m = mockCompanyInfo(domain);
    return { domain, hq: m.hunterHq, source: "mock" };
  }
  const c = await get("/companies/find", { domain });
  const geo = c?.geo as { city?: string; state?: string; country?: string } | undefined;
  const hq = geo ? [geo.city, geo.state, geo.country].filter(Boolean).join(", ") || null : null;
  return { domain, hq, source: "hunter" };
}
