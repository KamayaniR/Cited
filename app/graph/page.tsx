"use client";
import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Card, PageTitle } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { RefreshButton } from "@/components/RefreshButton";
import { api } from "@/components/api";
import type { QueryKey, WarmRow, HiringRow, DisplacementRow } from "@/lib/graph/queries";

interface Stats { engine: "neo4j" | "memory"; nodes: Record<string, number>; edges: Record<string, number>; nodeCount: number; edgeCount: number }
interface Result { q: QueryKey; title: string; question: string; rows: unknown[]; engine: "neo4j" | "memory"; cypher: string; ms: number; fallback?: string }

const TABS: { key: QueryKey; label: string }[] = [
  { key: "warm", label: "Warm paths" },
  { key: "hiring", label: "Hiring → evaluation" },
  { key: "displacement", label: "Competitor displacement" },
];

export default function GraphPage() {
  const { ws, refresh } = useWorkspace();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<QueryKey>("warm");
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const has = Boolean(ws?.companies.length);

  const run = useCallback(async (q: QueryKey) => {
    setTab(q); setBusy(true); setError(null);
    try { setRes(await api<Result>(`/api/graph/query?q=${q}`)); await refresh(); }
    catch (e) { setError((e as Error).message); setRes(null); }
    finally { setBusy(false); }
  }, [refresh]);

  const companyCount = ws?.companies.length ?? 0;
  useEffect(() => { if (companyCount) api<Stats>("/api/graph").then(setStats).catch(() => {}); }, [companyCount, ws?.signals.length]);

  if (!has) return (<div><PageTitle kicker="Graph" title="Knowledge graph queries" /><EmptyState what="companies" /></div>);

  return (
    <div>
      <PageTitle kicker="Graph" title="Knowledge graph queries"><RefreshButton /></PageTitle>

      {stats && (
        <Card className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 p-4 text-[13px]">
          <Badge tone={stats.engine === "neo4j" ? "green" : "neutral"}>{stats.engine === "neo4j" ? "Neo4j Aura" : "In-memory graph"}</Badge>
          <span><span className="font-mono">{stats.nodeCount}</span> nodes · <span className="font-mono">{stats.edgeCount}</span> edges</span>
          <span className="text-muted">{Object.entries(stats.nodes).map(([k, v]) => `${k} ${v}`).join(" · ")}</span>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key && Boolean(res)} onClick={() => run(t.key)} disabled={busy}
            className={`rounded-[6px] px-3 py-1.5 text-[13px] font-medium ${tab === t.key && res ? "bg-ink text-white" : "border border-line bg-white hover:bg-paper"}`}>{t.label}</button>
        ))}
        <span className="text-[12px] text-muted">1 credit per query</span>
      </div>

      {error && <div className="mb-3 rounded-[6px] bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div>}
      {!res && !busy && <Card className="p-6 text-[13px] text-muted">Pick a query to run it against the graph.</Card>}
      {busy && <Card className="p-6 text-[13px] text-muted">Running…</Card>}

      {res && !busy && (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div>
            <p className="mb-3 text-[13px] text-muted">{res.question}</p>
            {res.rows.length === 0 && <Card className="p-4 text-[13px] text-muted">No matches in the current graph.</Card>}
            <div className="space-y-2">
              {res.q === "warm" && (res.rows as WarmRow[]).map((r, i) => <WarmPath key={i} r={r} />)}
              {res.q === "hiring" && (res.rows as HiringRow[]).map((r, i) => <HiringCard key={i} r={r} />)}
              {res.q === "displacement" && (res.rows as DisplacementRow[]).map((r, i) => <DisplacementCard key={i} r={r} />)}
            </div>
          </div>
          <Card className="h-fit p-4">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
              <span className="font-semibold">Cypher</span>
              <span className="font-mono normal-case">{res.engine} · {res.rows.length} rows · {res.ms.toFixed(1)} ms</span>
            </div>
            {res.fallback && <div className="mb-2 text-[12px] text-tier-b">{res.fallback}</div>}
            <pre className="whitespace-pre-wrap break-words rounded-[6px] bg-ink p-3 font-mono text-[11px] leading-relaxed text-white">{res.cypher}</pre>
            {res.engine === "memory" && <p className="mt-2 text-[12px] text-muted">Neo4j isn&apos;t connected, so the same query ran on the in-memory graph with the same row shape.</p>}
          </Card>
        </div>
      )}
    </div>
  );
}

function Node({ kind, children }: { kind: "team" | "via" | "person" | "company"; children: React.ReactNode }) {
  const tone = { team: "border-accent/40 bg-accent/10", via: "border-line bg-paper", person: "border-rep/40 bg-rep/10", company: "border-line bg-white" }[kind];
  return <div className={`rounded-[6px] border px-2.5 py-1.5 text-[12px] ${tone}`}>{children}</div>;
}
const Arrow = ({ label }: { label: string }) => (
  <div className="flex flex-col items-center px-1 text-[10px] text-muted"><span className="font-mono">{label}</span><span aria-hidden>→</span></div>
);

function WarmPath({ r }: { r: WarmRow }) {
  const rel = r.viaLabel === "School" ? "studied_at" : "previously_employed_at";
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-1">
        <Node kind="team"><div className="font-medium">{r.team}</div><div className="text-muted">{r.teamRole}</div></Node>
        <Arrow label={rel} />
        <Node kind="via"><div className="text-[10px] uppercase text-muted">{r.viaLabel}</div><div className="font-medium">{r.via}</div></Node>
        <Arrow label={rel} />
        <Node kind="person"><div className="font-medium">{r.person}</div><div className="text-muted">{r.title}</div></Node>
        <Arrow label="works_at" />
        <Node kind="company"><div className="font-medium">{r.company}</div><div className="text-muted">Tier {r.tier}</div></Node>
        {r.isBuyer && <Badge tone="green" title="This person is the lead's buyer">buyer</Badge>}
      </div>
    </Card>
  );
}

function HiringCard({ r }: { r: HiringRow }) {
  return (
    <Card className="p-3 text-[13px]">
      <div className="flex items-center gap-2"><span className="font-medium">{r.company}</span><Badge>Tier {r.tier}</Badge>{r.buyer && <span className="text-muted">Buyer: {r.buyer}, {r.buyerTitle}</span>}</div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div><div className="text-[11px] uppercase tracking-wider text-muted">Hiring</div><a href={r.hiringUrl} target="_blank" rel="noreferrer" className="hover:underline">{r.hiring}</a></div>
        <div><div className="text-[11px] uppercase tracking-wider text-muted">Evaluation trigger</div>{r.evaluation.map((e) => <div key={e}>{e}</div>)}</div>
      </div>
    </Card>
  );
}

function DisplacementCard({ r }: { r: DisplacementRow }) {
  return (
    <Card className="p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{r.company}</span><Badge>Tier {r.tier}</Badge>
        <span className="text-muted">uses</span><Badge tone="red">{r.competitor}</Badge>
        {r.renewal && <Badge tone="amber">renewal window</Badge>}
        {r.buyer && <span className="text-muted">Buyer: {r.buyer}, {r.buyerTitle}</span>}
      </div>
      <div className="mt-2">Evidence: <a href={r.evidenceUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">{r.evidence}</a></div>
      <div className="mt-1 text-muted">Our angle: {r.angle}</div>
    </Card>
  );
}
