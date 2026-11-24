import "server-only";
import type { Workspace } from "@/lib/types";
import { CREDIT_PRICES, ingestEvent, type MeteredEvent } from "@/lib/providers/flexprice";
import { ApiError } from "@/lib/api/errors";
import { newId, nowIso } from "@/lib/ids";

/** Throws CREDIT_LIMIT (402) when the balance can't cover the event. Check before calling any paid vendor. */
export function requireCredits(ws: Workspace, event: MeteredEvent, quantity = 1, extra: Record<string, unknown> = {}) {
  const need = CREDIT_PRICES[event] * quantity;
  if (ws.org.creditsBalance < need) {
    throw new ApiError("CREDIT_LIMIT", `Need ${need} credits, balance ${ws.org.creditsBalance}`, { event, need, balance: ws.org.creditsBalance }, extra);
  }
}

/** Deduct and record a usage event; reports to Flexprice in the background (unsynced rows are retried by cron). */
export function charge(ws: Workspace, event: MeteredEvent, leadId: string | null, quantity = 1) {
  const credits = CREDIT_PRICES[event] * quantity;
  ws.org.creditsBalance -= credits;
  const row = { id: newId("use"), eventName: event, quantity, credits, leadId, flexpriceSynced: false, at: nowIso() };
  ws.usageEvents.unshift(row);
  void ingestEvent({ eventName: event, quantity, customerId: ws.org.id, properties: { lead_id: leadId ?? "" } }).then((r) => { row.flexpriceSynced = r.synced; });
  return row;
}
