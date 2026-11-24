import "server-only";
import type { Workspace } from "@/lib/types";
import { getWorkspace, mutate, audit } from "@/lib/db/store";
import { isLive } from "@/lib/env";
import {
  CREDIT_PRICES, EVENT_LABELS, PLANS, OVERAGE_USD_PER_CREDIT, roundCredits,
  ingestEvent, ensureCustomer, createWallet, walletBalance, topUpWallet, type MeteredEvent,
} from "@/lib/providers/flexprice";
import { ApiError } from "@/lib/api/errors";
import { newId } from "@/lib/ids";

export const TOPUP_MIN = 10;
export const TOPUP_MAX = 5000;

/**
 * The local ledger (org.creditsBalance) is the gate: it is checked synchronously before every paid
 * call, so a slow or unreachable billing API can never let spend run past zero. Flexprice is the
 * meter and the wallet: every charge is sent as an event (deduplicated by our row id), top-ups go
 * to the wallet, and unsynced events are retried by the cron route.
 */
export async function linkWallet(): Promise<{ customerId: string; walletId: string } | null> {
  if (!isLive("flexprice")) return null;
  const ws = getWorkspace();
  if (ws.org.flexpriceCustomerId && ws.org.flexpriceWalletId) return { customerId: ws.org.flexpriceCustomerId, walletId: ws.org.flexpriceWalletId };
  const customerId = ws.org.flexpriceCustomerId ?? await ensureCustomer(ws.org);
  const walletId = await createWallet(customerId, ws.org.creditsBalance);
  mutate((w) => {
    w.org.flexpriceCustomerId = customerId; w.org.flexpriceWalletId = walletId;
    audit(w, { actor: "agent", agent: "billing", action: "flexprice_linked", target: walletId, detail: `Flexprice customer ${customerId}, wallet loaded with ${w.org.creditsBalance} credits` });
  });
  return { customerId, walletId };
}

export async function topUp(credits: number, actor: "rep" | "agent" = "rep") {
  if (!Number.isInteger(credits) || credits < TOPUP_MIN || credits > TOPUP_MAX) throw new ApiError("VALIDATION_ERROR", `Top up between ${TOPUP_MIN} and ${TOPUP_MAX} whole credits`);
  const id = newId("top");
  let flexprice: "synced" | "failed" | "mock" = "mock";
  if (isLive("flexprice")) {
    try {
      const link = await linkWallet();
      flexprice = link && await topUpWallet(link.walletId, credits, id) ? "synced" : "failed";
    } catch { flexprice = "failed"; }
  }
  const balance = mutate((ws) => {
    ws.org.creditsBalance = roundCredits(ws.org.creditsBalance + credits);
    audit(ws, { actor, agent: "billing", action: "credits_topped_up", target: id, detail: `+${credits} credits ($${(credits * OVERAGE_USD_PER_CREDIT).toFixed(2)}); Flexprice ${flexprice}` });
    return ws.org.creditsBalance;
  });
  return { balance, added: credits, flexprice };
}

/** Retry usage events that never reached Flexprice (no key at the time, or a network error). */
export async function syncPendingUsage(limit = 200): Promise<{ attempted: number; synced: number; mode: "live" | "mock" }> {
  if (!isLive("flexprice")) return { attempted: 0, synced: 0, mode: "mock" };
  const ws = getWorkspace();
  const pending = ws.usageEvents.filter((u) => !u.flexpriceSynced).slice(0, limit);
  const done = new Set<string>();
  for (const u of pending) {
    const r = await ingestEvent({ eventId: u.id, eventName: u.eventName, quantity: u.quantity, customerId: ws.org.id, timestamp: u.at, properties: { lead_id: u.leadId ?? "" } });
    if (r.synced) done.add(u.id);
  }
  mutate((w) => { for (const u of w.usageEvents) if (done.has(u.id)) u.flexpriceSynced = true; });
  return { attempted: pending.length, synced: done.size, mode: "live" };
}

export async function billingSummary(ws: Workspace) {
  const byEvent = (Object.keys(CREDIT_PRICES) as MeteredEvent[]).map((e) => {
    const rows = ws.usageEvents.filter((u) => u.eventName === e);
    return { event: e, label: EVENT_LABELS[e], price: CREDIT_PRICES[e], count: rows.reduce((s, u) => s + u.quantity, 0), credits: roundCredits(rows.reduce((s, u) => s + u.credits, 0)) };
  });
  let wallet: { id: string; credits: number; cached: boolean } | null = null;
  if (isLive("flexprice") && ws.org.flexpriceWalletId) {
    const b = await walletBalance(ws.org.flexpriceWalletId).catch(() => null);
    if (b) wallet = { id: ws.org.flexpriceWalletId, ...b };
  }
  return {
    balance: ws.org.creditsBalance,
    plan: PLANS.find((p) => p.id === (ws.org.plan ?? "free"))!,
    plans: PLANS,
    overageUsdPerCredit: OVERAGE_USD_PER_CREDIT,
    byEvent,
    spent: roundCredits(byEvent.reduce((s, e) => s + e.credits, 0)),
    unsynced: ws.usageEvents.filter((u) => !u.flexpriceSynced).length,
    flexprice: { mode: isLive("flexprice") ? ("live" as const) : ("mock" as const), customerId: ws.org.flexpriceCustomerId ?? null, wallet },
    llmCostUsd: Number(ws.agentEvents.reduce((s, e) => s + e.costUsd, 0).toFixed(4)),
  };
}
