"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Card, PageTitle } from "@/components/ui";
import { Tip } from "@/components/Tip";
import { Share2, Handshake, Briefcase, Swords, Building2, User, GraduationCap, Users, Code2, Timer, Coins, ExternalLink, Lightbulb, CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { RefreshButton } from "@/components/RefreshButton";
import { api } from "@/components/api";
import type { QueryKey, WarmRow, HiringRow, DisplacementRow } from "@/lib/graph/queries";
import { GraphNetwork, LABEL_COLOR, type NetNode, type NetEdge } from "@/components/GraphNetwork";

interface Stats { engine: "neo4j" | "memory"; nodes: Record<string, number>; edges: Record<string, number>; nodeCount: number; edgeCount: number; graph?: { nodes: NetNode[]; edges: NetEdge[] } }
interface Result { q: QueryKey; title: string; question: string; rows: unknown[]; engine: "neo4j" | "memory"; cypher: string; ms: number; fallback?: string }

const TABS: { key: QueryKey; label: string; icon: typeof Share2; tip: string }[] = [
  { key: "warm", label: "Warm paths", icon: Handshake, tip: "Our team and their buyer share a past employer or school" },
  { key: "hiring", label: "Hiring → evaluation", icon: Briefcase, tip: "Hiring for the role that evaluates a tool like ours" },
  { key: "displacement", label: "Competitor displacement", icon: Swords, tip: "Customers of a competitor, ideally near renewal" },
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
  useEffect(() => { if (companyCount) api<Stats>("/api/graph?full=1").then(setStats).catch(() => {}); }, [companyCount, ws?.signals.length, ws?.people.length, ws?.companies]);
  const highlight = useMemo(() => (res && stats?.graph ? matchRows(res, stats.graph.nodes) : null), [res, stats]);

  const title = <PageTitle icon={Share2} title="Knowledge graph" tip="Companies, people, signals, competitors, schools and our team as a graph. Multi-hop queries find the warm way in. 0.5 credits per query."><RefreshButton /></PageTitle>;
  if (!has) return (<div>{title}<EmptyState what="companies" /></div>);

  return (
    <div>
      {title}

      {stats?.graph && (
        <Card className="mb-4 overflow-hidden">
          <div className="border-b border-line px-3.5 py-2.5">
            <p className="text-[13px]">Everything Cited knows, as one map: <b>{stats.nodes.Company ?? 0} companies</b>, the <b>people</b> who work there, the <b>signals</b> we cited, your <b>competitors</b>, and your own <b>team</b>. Lines are relationships such as &ldquo;works at&rdquo; or &ldquo;previously worked at&rdquo;.</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] text-muted">
              {Object.entries(LABEL_COLOR).filter(([k]) => stats.nodes[k]).map(([k, c]) => <span key={k} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{k}</span>)}
              <span className="ml-auto">{highlight?.size ? `${res?.title}: ${highlight.size} nodes lit` : "Hover a dot to see its links, click it for details"}</span>
              <Badge tone={stats.engine === "neo4j" ? "green" : "neutral"} title={stats.engine === "neo4j" ? "Live Neo4j Aura" : "Neo4j isn't connected: the same queries run on an in-memory graph"}>{stats.engine === "neo4j" ? "Neo4j" : "In-memory"} · {stats.nodeCount} nodes · {stats.edgeCount} links</Badge>
            </div>
          </div>
          <GraphNetwork nodes={stats.graph.nodes} edges={stats.graph.edges} highlight={highlight} />
        </Card>
      )}

      <div className="mb-2 text-[12px] font-semibold tracking-wider text-muted uppercase">Ask the graph</div>
      <div className="mb-3 grid gap-2 md:grid-cols-3" role="tablist">
        {TABS.map((t) => {
          const on = tab === t.key && Boolean(res);
          return (
            <Tip key={t.key} content={t.tip} className="block">
              <button role="tab" aria-selected={on} onClick={() => run(t.key)} disabled={busy}
                className={`flex w-full items-center gap-2.5 rounded-[10px] border px-3 py-2.5 text-left text-[13px] font-medium transition ${on ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-accent"}`}>
                <span className={`grid h-8 w-8 place-items-center rounded-[8px] ${on ? "bg-white/15" : "bg-accent/10 text-accent"}`}><t.icon size={16} /></span>
                <span className="flex-1">{t.label}</span>
                <span className={`inline-flex items-center gap-0.5 text-[11px] ${on ? "text-white/70" : "text-muted"}`}><Coins size={11} />0.5</span>
              </button>
            </Tip>
          );
        })}
      </div>

      {error && <div role="alert" className="mb-3 rounded-[6px] bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</div>}
      {busy && <Card className="grid place-items-center gap-2 p-10 text-[13px] text-muted"><Share2 size={20} className="animate-pulse" />Running…</Card>}

      {res && !busy && (
        <div>
          <Card className="mb-2 flex flex-wrap items-center gap-2 border-l-4 border-l-accent p-3">
            <Lightbulb size={16} className="text-accent" />
            <span className="text-[14px] font-medium">{answer(res)}</span>
            <span className="ml-auto flex items-center gap-1">
              <Badge tone={res.engine === "neo4j" ? "green" : "neutral"} title={res.fallback ?? (res.engine === "memory" ? "Neo4j isn't connected, so the same query ran on the in-memory graph with the same row shape." : "Ran on Neo4j")}>{res.fallback ? "memory · fallback" : res.engine}</Badge>
              <Badge icon={Timer}>{res.ms.toFixed(1)} ms</Badge>
            </span>
          </Card>
          <div className="space-y-2">
            {res.q === "warm" && (res.rows as WarmRow[]).map((r, i) => <WarmPath key={i} r={r} />)}
            {res.q === "hiring" && (res.rows as HiringRow[]).map((r, i) => <HiringCard key={i} r={r} />)}
            {res.q === "displacement" && (res.rows as DisplacementRow[]).map((r, i) => <DisplacementCard key={i} r={r} />)}
          </div>
          <details className="mt-2 text-[12px] text-muted">
            <summary className="inline-flex cursor-pointer items-center gap-1 hover:text-ink"><Code2 size={13} />Show query (Cypher)</summary>
            <pre className="mt-1.5 max-h-[320px] overflow-auto rounded-[8px] bg-ink p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-white">{res.cypher}</pre>
          </details>
        </div>
      )}
    </div>
  );
}

/** One plain-English sentence answering the query. */
function answer(res: Result): string {
  const n = res.rows.length;
  const uniq = (xs: (string | null | undefined)[]) => [...new Set(xs.filter(Boolean))] as string[];
  if (!n) return res.q === "warm" ? "No shared employers or schools between your team and these buyers yet." : res.q === "hiring" ? "None of these companies is hiring for a role that would evaluate you right now." : "No company here is known to use a competitor yet.";
  if (res.q === "warm") {
    const r = res.rows[0] as WarmRow;
    const cos = uniq((res.rows as WarmRow[]).map((x) => x.company));
    return `${n} warm path${n > 1 ? "s" : ""} into ${cos.length} compan${cos.length > 1 ? "ies" : "y"}. For example, ${r.team} and ${r.person} (${r.company}) both ${r.viaLabel === "School" ? "studied at" : "worked at"} ${r.via}.`;
  }
  if (res.q === "hiring") {
    const cos = uniq((res.rows as HiringRow[]).map((x) => x.company));
    return `${cos.length} compan${cos.length > 1 ? "ies are" : "y is"} hiring for a role that would evaluate a tool like yours: ${cos.slice(0, 3).join(", ")}${cos.length > 3 ? "…" : ""}.`;
  }
  const rows = res.rows as DisplacementRow[];
  const cos = uniq(rows.map((x) => x.company)), comps = uniq(rows.map((x) => x.competitor)), ren = uniq(rows.filter((x) => x.renewal).map((x) => x.company));
  return `${cos.length} compan${cos.length > 1 ? "ies use" : "y uses"} ${comps.slice(0, 3).join(" or ")}${ren.length ? `, and ${ren.length} ${ren.length > 1 ? "are" : "is"} near renewal` : ""}.`;
}

/** The nodes a query's rows touch: their companies, people, team members, schools, competitors and evidence pages. */
function matchRows(res: Result, nodes: NetNode[]): Set<string> {
  const ids = new Set<string>();
  const byName = new Map<string, string[]>();
  for (const n of nodes) { const k = String(n.props.name ?? "").toLowerCase(); if (k) byName.set(k, [...(byName.get(k) ?? []), n.id]); }
  const addName = (x: string | null | undefined) => { if (x) for (const id of byName.get(x.toLowerCase()) ?? []) ids.add(id); };
  const addUrl = (u: string) => { for (const n of nodes) if (n.props.url === u) ids.add(n.id); };
  for (const r of res.rows as (WarmRow & HiringRow & DisplacementRow)[]) {
    ids.add(r.companyId);
    if (res.q === "warm") { addName(r.team); addName(r.via); addName(r.person); }
    if (res.q === "hiring") { addName(r.buyer); addUrl(r.hiringUrl); }
    if (res.q === "displacement") { addName(r.buyer); addName(r.competitor); addUrl(r.evidenceUrl); }
  }
  return ids;
}

function Node({ kind, children, school }: { kind: "team" | "via" | "person" | "company"; children: React.ReactNode; school?: boolean }) {
  const tone = { team: "border-accent/40 bg-accent/10", via: "border-line bg-paper", person: "border-rep/40 bg-rep/10", company: "border-line bg-white" }[kind];
  const I = { team: Users, via: school ? GraduationCap : Building2, person: User, company: Building2 }[kind];
  return <div className={`flex items-center gap-2 rounded-[8px] border px-2.5 py-1.5 text-[12px] ${tone}`}><I size={14} className="shrink-0 opacity-70" /><div className="leading-tight">{children}</div></div>;
}
const Arrow = ({ label }: { label: string }) => (
  <Tip content={label}><span className="flex items-center px-0.5 text-muted" aria-label={label}><span className="h-px w-4 bg-line" /><span aria-hidden className="text-[10px]">▶</span></span></Tip>
);

function WarmPath({ r }: { r: WarmRow }) {
  const rel = r.viaLabel === "School" ? "studied_at" : "previously_employed_at";
  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-center gap-1">
        <Node kind="team"><div className="font-medium">{r.team}</div><div className="text-muted">{r.teamRole}</div></Node>
        <Arrow label={rel} />
        <Node kind="via" school={r.viaLabel === "School"}><div className="font-medium">{r.via}</div><div className="text-[10px] text-muted">{r.viaLabel}</div></Node>
        <Arrow label={rel} />
        <Node kind="person"><div className="font-medium">{r.person}</div><div className="text-muted">{r.title}</div></Node>
        <Arrow label="works_at" />
        <Node kind="company"><div className="font-medium">{r.company}</div><div className="text-muted">Tier {r.tier}</div></Node>
        {r.isBuyer && <span className="ml-1"><Badge tone="green" icon={Handshake} title="This person is the lead's buyer">buyer</Badge></span>}
      </div>
    </Card>
  );
}

function HiringCard({ r }: { r: HiringRow }) {
  return (
    <Card className="p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2"><Building2 size={14} className="text-muted" /><span className="font-medium">{r.company}</span><Badge>Tier {r.tier}</Badge>{r.buyer && <Badge icon={User} tone="blue" title={r.buyerTitle}>{r.buyer}</Badge>}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
        <a href={r.hiringUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-[6px] bg-rep/10 px-2 py-1 text-rep hover:underline"><Briefcase size={12} />{r.hiring}</a>
        <span className="text-muted">▶</span>
        {r.evaluation.map((e) => <span key={e} className="inline-flex items-center gap-1 rounded-[6px] bg-tier-b/10 px-2 py-1 text-tier-b"><Lightbulb size={12} />{e}</span>)}
      </div>
    </Card>
  );
}

function DisplacementCard({ r }: { r: DisplacementRow }) {
  return (
    <Card className="p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Building2 size={14} className="text-muted" /><span className="font-medium">{r.company}</span><Badge>Tier {r.tier}</Badge>
        <Badge tone="red" icon={Swords}>{r.competitor}</Badge>
        {r.renewal && <Badge tone="amber" icon={CalendarClock}>renewal window</Badge>}
        {r.buyer && <Badge icon={User} tone="blue" title={r.buyerTitle}>{r.buyer}</Badge>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
        <Tip content={r.evidence}><a href={r.evidenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-[5px] bg-accent/10 px-1.5 py-0.5 text-accent hover:underline"><ExternalLink size={11} />evidence</a></Tip>
        <span className="inline-flex items-center gap-1 text-ink/80"><Lightbulb size={12} className="text-tier-a" />{r.angle}</span>
      </div>
    </Card>
  );
}
