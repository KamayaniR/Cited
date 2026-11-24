"use client";
import { useEffect, useState } from "react";
import { BarChart3, Users, MessageCircleReply, CalendarCheck, Trophy, Factory, Layers, FlaskConical } from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Card, PageTitle, Segmented, SectionTitle, Stat } from "@/components/ui";
import { Tip } from "@/components/Tip";
import { EmptyState } from "@/components/EmptyState";
import { api } from "@/components/api";
import type { FunnelRow, GroupBy } from "@/lib/pipeline/analytics";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const RATES: { key: "replyRate" | "meetingRate" | "winRate"; label: string; color: string }[] = [
  { key: "replyRate", label: "Reply", color: "#7C3AED" },
  { key: "meetingRate", label: "Meeting", color: "#0284C7" },
  { key: "winRate", label: "Win", color: "#059669" },
];

export default function AnalyticsPage() {
  const { ws } = useWorkspace();
  const [groupBy, setGroupBy] = useState<GroupBy>("variant");
  const [data, setData] = useState<{ total: FunnelRow | null; rows: FunnelRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ws?.leads.length) return;
    api<{ total: FunnelRow | null; rows: FunnelRow[] }>(`/api/analytics?groupBy=${groupBy}`).then(setData).catch((e) => setError(e.message));
  }, [ws, groupBy]);

  const title = <PageTitle icon={BarChart3} title="Analytics" tip="Conversion by industry, tier and A/B variant. Counts come from each lead's stage history, so a lead dragged straight to Meeting Booked still counts as contacted and replied. Rates are over contacted leads; win rate is over closed leads." />;
  if (!ws?.leads.length) return <div>{title}<EmptyState what="leads" /></div>;
  const t = data?.total;

  return (
    <div>
      {title}
      {error && <div className="mb-3 rounded-[6px] bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div>}
      {t && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={Users} label="Leads" value={t.leads} />
            <Stat icon={MessageCircleReply} label="Reply rate" value={pct(t.replyRate)} tone="violet" tip={`${t.reached.replied} of ${t.reached.contacted} contacted`} />
            <Stat icon={CalendarCheck} label="Meeting rate" value={pct(t.meetingRate)} tone="blue" tip={`${t.reached.meeting_booked} of ${t.reached.contacted} contacted`} />
            <Stat icon={Trophy} label="Win rate" value={pct(t.winRate)} tone="green" tip={`${t.won} won, ${t.lost} lost`} />
          </div>
          <Card className="mb-5 p-4">
            <SectionTitle>Funnel</SectionTitle>
            <Funnel row={t} />
          </Card>
        </>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented value={groupBy} onChange={setGroupBy} options={[
          { value: "industry", label: "Industry", icon: Factory },
          { value: "tier", label: "Tier", icon: Layers },
          { value: "variant", label: "A/B variant", icon: FlaskConical },
        ]} />
        <span className="flex items-center gap-3 text-[11px] text-muted">{RATES.map((r) => <span key={r.key} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: r.color }} />{r.label}</span>)}</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data?.rows.map((r) => (
          <Card key={r.group} className="p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <span className="truncate font-medium">{r.group}</span>
              <Tip content={`Contacted ${r.reached.contacted} · replied ${r.reached.replied} · meetings ${r.reached.meeting_booked} · won ${r.won} / lost ${r.lost}`}>
                <span className="flex items-center gap-1 text-[11px] text-muted"><Users size={12} />{r.leads}</span>
              </Tip>
            </div>
            <div className="flex h-24 items-end gap-3">
              {RATES.map((k) => {
                const v = k.key === "winRate" && !(r.won + r.lost) ? null : r[k.key];
                return (
                  <Tip key={k.key} content={`${k.label} rate ${v === null ? "n/a (no closes)" : pct(v)}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="font-mono text-[10px] text-muted">{v === null ? "–" : pct(v)}</span>
                    <span className="w-full rounded-t-[4px]" style={{ height: `${Math.max(v ? 4 : 2, (v ?? 0) * 70)}px`, background: v === null ? "#E5E5E5" : k.color }} />
                  </Tip>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Funnel({ row }: { row: FunnelRow }) {
  const steps = [
    { label: "Matched", n: row.reached.matched, color: "#9CA3AF" },
    { label: "Contacted", n: row.reached.contacted, color: "#0284C7" },
    { label: "Replied", n: row.reached.replied, color: "#7C3AED" },
    { label: "Meeting", n: row.reached.meeting_booked, color: "#0F766E" },
    { label: "Won", n: row.won, color: "#059669" },
  ];
  const max = Math.max(1, row.leads);
  return (
    <div className="grid grid-cols-5 items-end gap-2">
      {steps.map((s, i) => (
        <Tip key={s.label} content={`${s.label}: ${s.n}${i ? ` (${Math.round((100 * s.n) / Math.max(1, steps[i - 1].n))}% of previous)` : ""}`} className="flex flex-col items-center gap-1.5">
          <span className="text-[18px] font-semibold tabular-nums">{s.n}</span>
          <span className="w-full rounded-[6px]" style={{ height: `${12 + (s.n / max) * 80}px`, background: s.color, opacity: 0.85 }} />
          <span className="text-[11px] text-muted">{s.label}</span>
        </Tip>
      ))}
    </div>
  );
}
