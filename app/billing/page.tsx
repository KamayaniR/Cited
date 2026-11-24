"use client";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Button, Card, PageTitle } from "@/components/ui";
import { api } from "@/components/api";

interface Summary {
  balance: number;
  plan: { id: string; name: string; priceUsd: number; credits: number; note: string };
  plans: { id: string; name: string; priceUsd: number; credits: number; note: string }[];
  overageUsdPerCredit: number;
  byEvent: { event: string; label: string; price: number; count: number; credits: number }[];
  spent: number;
  unsynced: number;
  flexprice: { mode: "live" | "mock"; customerId: string | null; wallet: { id: string; credits: number; cached: boolean } | null };
  llmCostUsd: number;
}

const PACKS = [100, 500, 1500];
const EVENT_LABEL: Record<string, string> = { lead_enriched: "Lead enriched", outreach_sent: "Outreach sent", graph_query: "Graph query", signal_refresh: "Signal refresh" };

export default function BillingPage() {
  const { ws, refresh } = useWorkspace();
  const [s, setS] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => api<Summary>("/api/billing").then(setS).catch((e) => setMsg(e.message)), []);
  const usageCount = ws?.usageEvents.length ?? 0;
  const balance = ws?.org.creditsBalance;
  useEffect(() => { void load(); }, [load, usageCount, balance]);

  async function topUp(amount: number) {
    setBusy(`top${amount}`); setMsg(null);
    try {
      const r = await api<{ balance: number; flexprice: string }>("/api/billing/topup", { method: "POST", body: { amount } });
      setMsg(`Added ${amount} credits. Balance ${r.balance}.${r.flexprice === "synced" ? " Flexprice wallet topped up." : r.flexprice === "failed" ? " Flexprice wallet top-up failed; local balance updated." : ""}`);
      await refresh();
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  }
  async function sync() {
    setBusy("sync"); setMsg(null);
    try { const r = await api<{ attempted: number; synced: number }>("/api/billing/sync", { method: "POST" }); setMsg(`Synced ${r.synced} of ${r.attempted} pending events to Flexprice.`); await refresh(); await load(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  }

  const usage = ws?.usageEvents ?? [];
  const low = (balance ?? 0) < 2;

  return (
    <div>
      <PageTitle kicker="Billing" title="Credits and usage" />
      {msg && <div className="mb-3 rounded-[6px] bg-accent/10 px-3 py-2 text-[13px]" role="status">{msg}</div>}

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Balance</div>
          <div className={`mt-1 font-serif text-[32px] leading-none ${low ? "text-danger" : ""}`}>{balance ?? 0}<span className="ml-1 text-[14px] text-muted">credits</span></div>
          {low && <div className="mt-1 text-[12px] text-danger">Paid calls are blocked (HTTP 402) until you top up.</div>}
          {s && <div className="mt-2 text-[12px] text-muted">{s.plan.name} plan · {s.plan.note}</div>}
        </Card>
        <Card className="p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Top up</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {PACKS.map((n) => (
              <Button key={n} variant="secondary" onClick={() => topUp(n)} disabled={busy !== null}>
                +{n} <span className="text-muted">${s ? (n * s.overageUsdPerCredit).toFixed(0) : ""}</span>
              </Button>
            ))}
          </div>
          <div className="mt-2 text-[12px] text-muted">${s?.overageUsdPerCredit.toFixed(2) ?? "0.08"} per credit. Demo only: no card is charged.</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">Flexprice</div>
            <Badge tone={s?.flexprice.mode === "live" ? "green" : "neutral"}>{s?.flexprice.mode === "live" ? "live" : "mock"}</Badge>
          </div>
          {s?.flexprice.mode === "live" ? (
            <div className="mt-2 space-y-1 text-[12px]">
              <div>Wallet: {s.flexprice.wallet ? <span className="font-mono">{s.flexprice.wallet.credits} credits{s.flexprice.wallet.cached ? " (cached)" : ""}</span> : <span className="text-muted">not linked yet</span>}</div>
              <div>Events waiting to sync: <span className="font-mono">{s.unsynced}</span></div>
              <Button variant="secondary" onClick={sync} disabled={busy !== null}>{busy === "sync" ? "Syncing…" : "Sync now"}</Button>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted">Every charge is recorded as a usage event and sent to Flexprice once <span className="font-mono">FLEXPRICE_API_KEY</span> is set. {s?.unsynced ?? 0} events are waiting.</p>
          )}
        </Card>
      </div>

      <Card className="mb-4">
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>{["Metered event", "Price", "Count", "Credits used"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {s?.byEvent.map((e) => (
              <tr key={e.event}>
                <td className="px-3 py-2">{e.label} <span className="font-mono text-[11px] text-muted">{e.event}</span></td>
                <td className="px-3 py-2 font-mono">{e.price}</td>
                <td className="px-3 py-2 font-mono">{e.count}</td>
                <td className="px-3 py-2 font-mono">{e.credits}</td>
              </tr>
            ))}
            {s && <tr className="font-medium"><td className="px-3 py-2">Total</td><td /><td /><td className="px-3 py-2 font-mono">{s.spent}</td></tr>}
          </tbody>
        </table>
        <p className="border-t border-line px-3 py-2 text-[12px] text-muted">Drafts are never charged: only enrichment, approved sends, graph queries and signal refreshes. LLM cost so far ${s?.llmCostUsd.toFixed(4) ?? "0"}.</p>
      </Card>

      <Card>
        <div className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Usage events</div>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted"><tr>{["When", "Event", "Credits", "Lead", "Flexprice"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {usage.slice(0, 100).map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-1.5 font-mono text-[11px] text-muted">{new Date(u.at).toLocaleString()}</td>
                <td className="px-3 py-1.5">{EVENT_LABEL[u.eventName] ?? u.eventName}</td>
                <td className="px-3 py-1.5 font-mono">{u.credits}</td>
                <td className="px-3 py-1.5 font-mono text-[11px]">{u.leadId}</td>
                <td className="px-3 py-1.5">{u.flexpriceSynced ? <Badge tone="green">synced</Badge> : <Badge>pending</Badge>}</td>
              </tr>
            ))}
            {!usage.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">No usage yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
