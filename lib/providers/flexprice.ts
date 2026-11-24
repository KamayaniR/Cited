import "server-only";
import { env, isLive } from "@/lib/env";

export type MeteredEvent = "lead_enriched" | "outreach_sent" | "graph_query" | "signal_refresh";

/** Credit price per metered event (spec Section 2, business model). */
export const CREDIT_PRICES: Record<MeteredEvent, number> = {
  lead_enriched: 2,
  outreach_sent: 1,
  graph_query: 0.5,
  signal_refresh: 0.2,
};

export const EVENT_LABELS: Record<MeteredEvent, string> = {
  lead_enriched: "Lead enriched",
  outreach_sent: "Outreach sent",
  graph_query: "Graph query",
  signal_refresh: "Signal refresh",
};

/** Plans (spec Section 2, pricing). The demo workspace is on Free. */
export const PLANS = [
  { id: "free", name: "Free", priceUsd: 0, credits: 100, note: "100 credits once, 1 ICP" },
  { id: "founder", name: "Founder", priceUsd: 99, credits: 1500, note: "1,500 credits a month, 1 ICP, 1 seat" },
  { id: "team", name: "Team", priceUsd: 399, credits: 7500, note: "7,500 credits a month, 5 ICPs, 5 seats" },
] as const;
export const OVERAGE_USD_PER_CREDIT = 0.08;

/** Credits are fractional (0.2, 0.5); keep one decimal so the ledger never drifts. */
export const roundCredits = (n: number) => Math.round(n * 10) / 10;

const headers = () => ({ "content-type": "application/json", "x-api-key": env.flexpriceKey! });
async function call<T>(method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(`${env.flexpriceBaseUrl}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => null)) as T | null;
  return { ok: res.ok, status: res.status, data };
}

/**
 * Report one usage event (POST /events). `event_id` is our usage row id, so a retry of an event
 * that already landed is deduplicated by Flexprice. Mock mode records locally only; rows stay
 * flexprice_synced=false and are retried by the cron route once a key is set.
 */
export async function ingestEvent(e: { eventId?: string; eventName: MeteredEvent; quantity: number; customerId: string; timestamp?: string; properties?: Record<string, string | number> }): Promise<{ synced: boolean; mode: "live" | "mock" }> {
  if (!isLive("flexprice")) return { synced: false, mode: "mock" };
  try {
    const props: Record<string, string> = { quantity: String(e.quantity), credits: String(CREDIT_PRICES[e.eventName] * e.quantity) };
    for (const [k, v] of Object.entries(e.properties ?? {})) props[k] = String(v);
    const r = await call("POST", "/events", {
      event_name: e.eventName,
      external_customer_id: e.customerId,
      ...(e.eventId ? { event_id: e.eventId } : {}),
      ...(e.timestamp ? { timestamp: e.timestamp } : {}),
      properties: props,
      source: "cited",
    });
    return { synced: r.ok, mode: "live" };
  } catch {
    return { synced: false, mode: "live" };
  }
}

interface CustomerResponse { id: string; external_id: string }
interface WalletResponse { id: string; customer_id: string; credit_balance?: string | number; real_time_credit_balance?: string | number }
interface WalletBalance { credit_balance?: string | number; real_time_credit_balance?: string | number; is_cached_fallback?: boolean }

/** Find or create the Flexprice customer for this org (external_id = our org id). */
export async function ensureCustomer(org: { id: string; name: string }): Promise<string> {
  const found = await call<CustomerResponse>("GET", `/customers/external/${encodeURIComponent(org.id)}`);
  if (found.ok && found.data?.id) return found.data.id;
  const created = await call<CustomerResponse>("POST", "/customers", { external_id: org.id, name: org.name });
  if (!created.ok || !created.data?.id) throw new Error(`Flexprice create customer failed: HTTP ${created.status}`);
  return created.data.id;
}

/** Create the prepaid credit wallet, loaded with the org's current balance. */
export async function createWallet(customerId: string, initialCredits: number): Promise<string> {
  const r = await call<WalletResponse>("POST", "/wallets", {
    customer_id: customerId, currency: "usd", conversion_rate: String(OVERAGE_USD_PER_CREDIT), wallet_type: "PRE_PAID",
    initial_credits_to_load: String(Math.max(0, initialCredits)), description: "Cited credits",
  });
  if (!r.ok || !r.data?.id) throw new Error(`Flexprice create wallet failed: HTTP ${r.status}`);
  return r.data.id;
}

export async function walletBalance(walletId: string): Promise<{ credits: number; cached: boolean } | null> {
  const r = await call<WalletBalance>("GET", `/wallets/${encodeURIComponent(walletId)}/balance/real-time`);
  if (!r.ok || !r.data) return null;
  const v = r.data.real_time_credit_balance ?? r.data.credit_balance;
  return v === undefined ? null : { credits: Number(v), cached: r.data.is_cached_fallback !== false };
}

/** Add purchased credits to the wallet (POST /wallets/{id}/top-up). Idempotent on our top-up id. */
export async function topUpWallet(walletId: string, credits: number, idempotencyKey: string): Promise<boolean> {
  const r = await call("POST", `/wallets/${encodeURIComponent(walletId)}/top-up`, {
    credits_to_add: String(credits), transaction_reason: "PURCHASED_CREDIT_DIRECT", idempotency_key: idempotencyKey, description: "Cited top-up",
  });
  return r.ok;
}
