"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Button } from "@/components/ui";
import { api } from "@/components/api";

interface RefreshResult { processed: number; added: number; skippedForCredits: number; filtered: string[]; tierChanges: { name: string; from: string; to: string; score: number }[] }

/** "Run refresh now": the same code path as the 6-hourly cron, so judges don't have to wait. */
export function RefreshButton({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const { ws, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const last = ws?.companies.map((c) => c.signalsRefreshedAt).sort().at(-1);
  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await api<RefreshResult>("/api/signals/refresh", { method: "POST", body: {} });
      const tiers = r.tierChanges.map((t) => `${t.name} ${t.from}→${t.to}`).join(", ");
      setMsg(`${r.processed} refreshed, ${r.added} new signals${tiers ? `; ${tiers}` : ""}${r.filtered.length ? `; ${r.filtered.length} filtered` : ""}${r.skippedForCredits ? `; ${r.skippedForCredits} skipped (credits)` : ""}`);
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); await refresh(); }
  };
  return (
    <span className="flex items-center gap-2">
      {msg ? <span className="max-w-[360px] text-[12px] text-muted" role="status">{msg}</span>
        : last && <span className="text-[12px] text-muted" title="Signals refresh every 6 hours for Tier A/B">Last refresh {new Date(last).toLocaleString()}</span>}
      <Button variant={variant} onClick={run} disabled={busy || !ws?.companies.length} title="Re-pull signals for Tier A/B companies, re-score and re-tier. 1 credit per company.">{busy ? "Refreshing…" : "Run refresh now"}</Button>
    </span>
  );
}
