import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildDemoWorkspace } from "@/lib/seed/demo";
import { replaceWorkspace, getWorkspace } from "@/lib/db/store";
import { charge, requireCredits } from "@/lib/pipeline/credits";
import { topUp, syncPendingUsage, linkWallet, billingSummary } from "@/lib/pipeline/billing";
import { CREDIT_PRICES, ingestEvent } from "@/lib/providers/flexprice";
import { POST as enrichPost } from "@/app/api/enrich/route";
import { POST as topupPost } from "@/app/api/billing/topup/route";

process.env.VERCEL = "1";

beforeEach(() => { delete process.env.FLEXPRICE_API_KEY; replaceWorkspace(buildDemoWorkspace(new Date())); });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.FLEXPRICE_API_KEY; });

describe("credit ledger", () => {
  it("uses the spec prices and keeps fractional balances exact", () => {
    expect(CREDIT_PRICES).toEqual({ lead_enriched: 2, outreach_sent: 1, graph_query: 0.5, signal_refresh: 0.2 });
    const ws = getWorkspace();
    ws.org.creditsBalance = 1;
    for (let i = 0; i < 3; i++) charge(ws, "signal_refresh", null);
    expect(ws.org.creditsBalance).toBe(0.4);
    charge(ws, "signal_refresh", null); charge(ws, "signal_refresh", null);
    expect(ws.org.creditsBalance).toBe(0);
    expect(() => requireCredits(ws, "graph_query")).toThrow(/Need 0.5 credits, balance 0/);
  });

  it("blocks enrichment with 402 at zero balance before any vendor call", async () => {
    const ws = getWorkspace();
    const lead = ws.leads.find((l) => l.stage === "matched")!;
    ws.leads = ws.leads.filter((l) => l.id !== lead.id); // put one company back in the enrichment queue
    ws.org.creditsBalance = 0;
    const people = ws.people.length;
    const res = await enrichPost(new Request("http://t/api/enrich", { method: "POST", body: "{}" }));
    expect(res.status).toBe(402);
    expect((await res.json()).error.code).toBe("CREDIT_LIMIT");
    expect(getWorkspace().people.length).toBe(people);
    expect(getWorkspace().auditLog[0].action).toBe("enrich_gated");
  });
});

describe("top-up", () => {
  it("adds credits, audits them, and validates the amount", async () => {
    getWorkspace().org.creditsBalance = 0;
    const res = await topupPost(new Request("http://t", { method: "POST", body: JSON.stringify({ amount: 100 }) }));
    expect(await res.json()).toMatchObject({ balance: 100, added: 100, flexprice: "mock" });
    expect(getWorkspace().auditLog[0]).toMatchObject({ action: "credits_topped_up", actor: "rep" });
    expect((await topupPost(new Request("http://t", { method: "POST", body: JSON.stringify({ amount: 5 }) }))).status).toBe(400);
    expect((await topupPost(new Request("http://t", { method: "POST", body: JSON.stringify({ amount: 10.5 }) }))).status).toBe(400);
  });

  it("summarises usage by event", async () => {
    const s = await billingSummary(getWorkspace());
    expect(s.byEvent.find((e) => e.event === "lead_enriched")!.count).toBe(6);
    expect(s.spent).toBe(100 - s.balance);
    expect(s.flexprice.mode).toBe("mock");
  });
});

describe("Flexprice (live, against a stubbed API)", () => {
  function stub() {
    const calls: { method: string; url: string; body: Record<string, unknown> | null }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
      const body = init.body ? JSON.parse(String(init.body)) : null;
      calls.push({ method: init.method ?? "GET", url, body });
      const json = (status: number, data: unknown) => new Response(JSON.stringify(data), { status });
      if (url.includes("/customers/external/")) return json(404, { code: "not_found" });
      if (url.endsWith("/customers")) return json(201, { id: "cus_1", external_id: body!.external_id });
      if (url.endsWith("/wallets")) return json(200, { id: "wal_1", customer_id: body!.customer_id });
      if (url.includes("/top-up")) return json(200, { wallet: { id: "wal_1" } });
      if (url.includes("/balance/real-time")) return json(200, { real_time_credit_balance: "150", is_cached_fallback: false });
      if (url.endsWith("/events")) return json(202, { event_id: body!.event_id });
      return json(404, {});
    }));
    process.env.FLEXPRICE_API_KEY = "test-key";
    return calls;
  }

  it("sends events with our row id for dedupe and string properties", async () => {
    const calls = stub();
    const r = await ingestEvent({ eventId: "use_1", eventName: "graph_query", quantity: 1, customerId: "org_demo", timestamp: "2026-11-24T00:00:00Z" });
    expect(r).toEqual({ synced: true, mode: "live" });
    expect(calls[0].body).toMatchObject({ event_name: "graph_query", external_customer_id: "org_demo", event_id: "use_1", source: "cited", properties: { quantity: "1", credits: "0.5" } });
  });

  it("links a customer and prepaid wallet once, then tops it up idempotently", async () => {
    const calls = stub();
    const link = await linkWallet();
    expect(link).toEqual({ customerId: "cus_1", walletId: "wal_1" });
    expect(calls.find((c) => c.url.endsWith("/wallets"))!.body).toMatchObject({ customer_id: "cus_1", wallet_type: "PRE_PAID", initial_credits_to_load: String(getWorkspace().org.creditsBalance) });
    const r = await topUp(50);
    expect(r.flexprice).toBe("synced");
    const t = calls.find((c) => c.url.includes("/top-up"))!;
    expect(t.body).toMatchObject({ credits_to_add: "50", transaction_reason: "PURCHASED_CREDIT_DIRECT" });
    expect(String(t.body!.idempotency_key)).toMatch(/^top_/);
    expect(calls.filter((c) => c.url.endsWith("/customers")).length).toBe(1);
    expect((await billingSummary(getWorkspace())).flexprice.wallet).toMatchObject({ id: "wal_1", credits: 150, cached: false });
  });

  it("retries unsynced usage and marks it synced", async () => {
    stub();
    const before = getWorkspace().usageEvents.filter((u) => !u.flexpriceSynced).length;
    expect(before).toBeGreaterThan(0);
    const r = await syncPendingUsage();
    expect(r).toMatchObject({ attempted: before, synced: before, mode: "live" });
    expect(getWorkspace().usageEvents.every((u) => u.flexpriceSynced)).toBe(true);
  });
});
