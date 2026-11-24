"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Button, Toast } from "@/components/ui";
import { Tip } from "@/components/Tip";
import { api } from "@/components/api";
import { useRun } from "@/components/run/RunProvider";

interface RefreshResult { processed: number; added: number; skippedForCredits: number; filtered: string[]; tierChanges: { name: string; from: string; to: string; score: number }[] }

/** "Run refresh now": the same code path as the 6-hourly cron, so judges don't have to wait. */
export function RefreshButton({ variant = "secondary" }: { variant?: "primary" | "secondary" }) {
  const { ws, refresh } = useWorkspace();
  const { track } = useRun();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const last = ws?.companies.map((c) => c.signalsRefreshedAt).sort().at(-1);
  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await track("refresh", "discovery", () => api<RefreshResult>("/api/signals/refresh", { method: "POST", body: {} }));
      const tiers = r.tierChanges.map((t) => `${t.name} ${t.from}→${t.to}`).join(", ");
      setMsg(`${r.processed} refreshed · +${r.added} signals${tiers ? ` · ${tiers}` : ""}${r.filtered.length ? ` · ${r.filtered.length} filtered` : ""}${r.skippedForCredits ? ` · ${r.skippedForCredits} skipped (credits)` : ""}`);
    } catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); await refresh(); }
  };
  return (
    <span className="flex items-center gap-2">
      {msg && <Toast>{msg}</Toast>}
      <Tip content={`Re-pull signals for Tier A/B, re-score and re-tier. Runs every 6 hours; 0.2 credits per company.${last ? `\nLast refresh ${new Date(last).toLocaleString()}` : ""}`}>
        <Button variant={variant} icon={RefreshCw} onClick={run} disabled={busy || !ws?.companies.length} className={busy ? "[&_svg]:animate-spin" : ""}>{busy ? "Refreshing…" : "Run refresh now"}</Button>
      </Tip>
    </span>
  );
}
