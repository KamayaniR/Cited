import "server-only";
import { env, isLive } from "@/lib/env";

export type MeteredEvent = "lead_enriched" | "outreach_sent" | "graph_query" | "signal_refresh";

/** Credit price per metered event (spec Section 2 pricing; tune in P5). */
export const CREDIT_PRICES: Record<MeteredEvent, number> = {
  lead_enriched: 2,
  outreach_sent: 1,
  graph_query: 1,
  signal_refresh: 1,
};

/**
 * Report a usage event to Flexprice. Mock mode only records locally (usage_events.flexprice_synced=false
 * is retried by the cron route). The local balance in the workspace is the gate; P5 syncs it with the wallet.
 */
export async function ingestEvent(e: { eventName: MeteredEvent; quantity: number; customerId: string; properties?: Record<string, string | number> }): Promise<{ synced: boolean; mode: "live" | "mock" }> {
  if (!isLive("flexprice")) return { synced: false, mode: "mock" };
  try {
    const res = await fetch(`${env.flexpriceBaseUrl}/events`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.flexpriceKey! },
      body: JSON.stringify({
        event_name: e.eventName,
        external_customer_id: e.customerId,
        properties: { quantity: e.quantity, ...e.properties },
        source: "cited",
      }),
    });
    return { synced: res.ok, mode: "live" };
  } catch {
    return { synced: false, mode: "live" };
  }
}
