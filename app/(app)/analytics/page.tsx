"use client";
import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Card, PageTitle } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/components/api";
import type { FunnelRow, GroupBy } from "@/lib/pipeline/analytics";

const GROUPS: { key: GroupBy; label: string }[] = [
  { key: "industry", label: "Industry" },
  { key: "tier", label: "Tier" },
  { key: "variant", label: "A/B variant" },
];
const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function AnalyticsPage() {
  const { ws } = useWorkspace();
  const [groupBy, setGroupBy] = useState<GroupBy>("variant");
  const [data, setData] = useState<{ total: FunnelRow | null; rows: FunnelRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ws?.leads.length) return;
    api<{ total: FunnelRow | null; rows: FunnelRow[] }>(`/api/analytics?groupBy=${groupBy}`).then(setData).catch((e) => setError(e.message));
  }, [ws, groupBy]);

  if (!ws?.leads.length) return (<div><PageTitle kicker="Analytics" title="Conversion by industry, tier and variant" /><EmptyState what="leads" /></div>);
  const t = data?.total;

  return (
    <div>
      <PageTitle kicker="Analytics" title="Conversion by industry, tier and variant" />
      {error && <div className="mb-3 rounded-[6px] bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div>}
      {t && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Leads" value={String(t.leads)} />
            <Stat label="Reply rate" value={pct(t.replyRate)} hint={`${t.reached.replied} of ${t.reached.contacted} contacted`} />
            <Stat label="Meeting rate" value={pct(t.meetingRate)} hint={`${t.reached.meeting_booked} of ${t.reached.contacted} contacted`} />
            <Stat label="Win rate" value={pct(t.winRate)} hint={`${t.won} won, ${t.lost} lost`} />
          </div>
          <Card className="mb-6 p-4">
            <div className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-muted">Funnel, all leads</div>
            <Funnel row={t} />
          </Card>
        </>
      )}
      <div className="mb-3 flex gap-1" role="tablist">
        {GROUPS.map((g) => (
          <button key={g.key} role="tab" aria-selected={groupBy === g.key} onClick={() => setGroupBy(g.key)}
            className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium ${groupBy === g.key ? "bg-ink text-white" : "border border-line bg-white"}`}>{g.label}</button>
        ))}
      </div>
      <Card>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>{["Group", "Leads", "Contacted", "Replied", "Meetings", "Won / lost", "Reply rate", "Win rate"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.rows.map((r) => (
              <tr key={r.group}>
                <td className="px-3 py-2 font-medium">{r.group}</td>
                <td className="px-3 py-2 font-mono">{r.leads}</td>
                <td className="px-3 py-2 font-mono">{r.reached.contacted}</td>
                <td className="px-3 py-2 font-mono">{r.reached.replied}</td>
                <td className="px-3 py-2 font-mono">{r.reached.meeting_booked}</td>
                <td className="px-3 py-2 font-mono">{r.won} / {r.lost}</td>
                <td className="px-3 py-2"><RateBar value={r.replyRate} /></td>
                <td className="px-3 py-2">{r.won + r.lost ? <RateBar value={r.winRate} /> : <span className="text-muted">no closes</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <p className="mt-3 text-[12px] text-muted">Counts come from each lead&apos;s stage history, so a lead dragged straight to Meeting Booked still counts as contacted and replied. Rates are over contacted leads; win rate is over closed leads.</p>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 font-serif text-[28px] leading-none">{value}</div>
      {hint && <div className="mt-1 text-[12px] text-muted">{hint}</div>}
    </Card>
  );
}

function Funnel({ row }: { row: FunnelRow }) {
  const steps = [
    { label: "Matched", n: row.reached.matched },
    { label: "Contacted", n: row.reached.contacted },
    { label: "Replied", n: row.reached.replied },
    { label: "Meeting booked", n: row.reached.meeting_booked },
    { label: "Closed won", n: row.won },
  ];
  const max = Math.max(1, row.leads);
  return (
    <div className="space-y-1.5">
      {steps.map((s) => (
        <div key={s.label} className="grid grid-cols-[130px_1fr_40px] items-center gap-3 text-[13px]">
          <span className="text-muted">{s.label}</span>
          <div className="h-5 rounded-[4px] bg-line/50"><div className="h-5 rounded-[4px] bg-accent" style={{ width: `${(s.n / max) * 100}%` }} /></div>
          <span className="text-right font-mono">{s.n}</span>
        </div>
      ))}
    </div>
  );
}

function RateBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-line"><div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round(value * 100)}%` }} /></div>
      <span className="font-mono text-[11px]">{pct(value)}</span>
    </div>
  );
}
