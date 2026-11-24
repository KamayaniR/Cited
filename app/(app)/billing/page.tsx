"use client";
import { useCallback, useEffect, useState } from "react";
import { CreditCard, Coins, Plus, RefreshCw, Users, Send, Share2, Activity, Zap, Ban } from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, BarRow, Button, Card, PageTitle, SectionTitle, Toast } from "@/components/ui";
import { Tip } from "@/components/Tip";
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
const EVENT_ICON: Record<string, typeof Users> = { lead_enriched: Users, outreach_sent: Send, graph_query: Share2, signal_refresh: RefreshCw };

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
      setMsg(`+${amount} credits · balance ${r.balance}${r.flexprice === "synced" ? " · Flexprice wallet topped up" : r.flexprice === "failed" ? " · Flexprice top-up failed, local balance updated" : ""}`);
      await refresh();
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  }
  async function drain() {
    setBusy("drain"); setMsg(null);
    try { await api("/api/demo/credits", { method: "POST", body: { balance: 0 } }); setMsg("Balance set to 0"); await refresh(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  }
  async function sync() {
    setBusy("sync"); setMsg(null);
    try { const r = await api<{ attempted: number; synced: number }>("/api/billing/sync", { method: "POST" }); setMsg(`Synced ${r.synced} of ${r.attempted} events`); await refresh(); await load(); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(null); }
  }

  const usage = ws?.usageEvents ?? [];
  const low = (balance ?? 0) < 2;
  const planCredits = s?.plan.credits ?? 0;
  const pctLeft = planCredits ? Math.min(100, Math.round(((balance ?? 0) / planCredits) * 100)) : 0;
  const maxCredits = Math.max(1, ...(s?.byEvent.map((e) => e.credits) ?? [1]));
  const live = s?.flexprice.mode === "live";

  return (
    <div>
      <PageTitle icon={CreditCard} title="Billing" tip="Credits are metered by Flexprice: 2 per lead enriched, 1 per approved send, 0.5 per graph query, 0.2 per refresh. Drafts are never charged.">
        {msg && <Toast>{msg}</Toast>}
      </PageTitle>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card className="p-4">
          <SectionTitle icon={Coins}>Balance</SectionTitle>
          <div className="flex items-end gap-3">
            <div className={`text-[36px] leading-none font-semibold tabular-nums ${low ? "text-danger" : ""}`}>{balance ?? 0}</div>
            {s && <span className="mb-1"><Badge tone="accent" title={`${s.plan.name} plan · ${s.plan.note}`}>{s.plan.name}</Badge></span>}
          </div>
          <div className="mt-3 h-2 rounded-full bg-line/70"><div className={`h-2 rounded-full ${low ? "bg-danger" : "bg-accent"}`} style={{ width: `${pctLeft}%` }} /></div>
          {low && <div className="mt-2 flex items-center gap-1 text-[12px] text-danger"><Ban size={12} />Paid calls are blocked (HTTP 402) until you top up.</div>}
        </Card>
        <Card className="p-4">
          <SectionTitle icon={Plus} tip={`$${s?.overageUsdPerCredit.toFixed(2) ?? "0.08"} per credit. Demo only: no card is charged.`}>Top up</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {PACKS.map((n) => (
              <Button key={n} variant="secondary" onClick={() => topUp(n)} disabled={busy !== null}>
                +{n} <span className="text-muted">${s ? (n * s.overageUsdPerCredit).toFixed(0) : ""}</span>
              </Button>
            ))}
          </div>
          {!s?.flexprice.wallet && <button className="mt-3 text-[12px] text-muted underline hover:text-danger" onClick={drain} disabled={busy !== null}>Demo: set balance to 0</button>}
        </Card>
        <Card className="p-4">
          <SectionTitle icon={Zap} right={<Badge tone={live ? "green" : "neutral"}>{live ? "live" : "mock"}</Badge>} tip={live ? undefined : "Every charge is recorded as a usage event and sent to Flexprice once FLEXPRICE_API_KEY is set."}>Flexprice</SectionTitle>
          <div className="space-y-1.5 text-[12px]">
            {live && <div className="flex justify-between"><span className="text-muted">Wallet</span>{s?.flexprice.wallet ? <span className="font-mono">{s.flexprice.wallet.credits}{s.flexprice.wallet.cached ? " (cached)" : ""}</span> : <span className="text-muted">not linked</span>}</div>}
            <div className="flex justify-between"><span className="text-muted">Waiting to sync</span><span className="font-mono">{s?.unsynced ?? 0}</span></div>
            <div className="flex justify-between"><span className="text-muted">LLM spend</span><span className="font-mono">${s?.llmCostUsd.toFixed(4) ?? "0"}</span></div>
            {live && <Button variant="secondary" icon={RefreshCw} onClick={sync} disabled={busy !== null}>{busy === "sync" ? "Syncing…" : "Sync now"}</Button>}
          </div>
        </Card>
      </div>

      <Card className="mb-4 p-4">
        <SectionTitle icon={Activity} tip="Drafts are never charged: only enrichment, approved sends, graph queries and signal refreshes." right={<span className="font-mono text-[12px]">{s?.spent ?? 0} credits</span>}>Usage by event</SectionTitle>
        <div className="space-y-2.5">
          {s?.byEvent.map((e) => {
            const I = EVENT_ICON[e.event] ?? Activity;
            return <BarRow key={e.event} label={<span className="inline-flex items-center gap-1.5"><I size={13} className="text-muted" />{e.label}</span>} value={e.credits} max={maxCredits} right={`${e.credits}`} tip={`${e.count} × ${e.price} credits`} />;
          })}
        </div>
      </Card>

      <Card>
        <div className="px-3 pt-3"><SectionTitle>Recent usage</SectionTitle></div>
        <ol className="divide-y divide-line">
          {usage.slice(0, 50).map((u) => {
            const I = EVENT_ICON[u.eventName] ?? Activity;
            return (
              <li key={u.id} className="flex items-center gap-3 px-3 py-1.5 text-[12px]">
                <I size={13} className="text-muted" />
                <span className="flex-1">{EVENT_LABEL[u.eventName] ?? u.eventName}</span>
                <span className="font-mono text-muted">-{u.credits}</span>
                <Tip content={u.flexpriceSynced ? "Synced to Flexprice" : "Waiting to sync to Flexprice"}><span className={`h-2 w-2 rounded-full ${u.flexpriceSynced ? "bg-tier-a" : "bg-tier-c"}`} /></Tip>
                <span className="w-[110px] text-right font-mono text-[10px] text-muted">{new Date(u.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            );
          })}
          {!usage.length && <li className="px-3 py-4 text-center text-muted">No usage yet</li>}
        </ol>
      </Card>
    </div>
  );
}
