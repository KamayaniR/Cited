"use client";
import { useState } from "react";
import { api } from "@/components/api";
import { Button } from "@/components/ui";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Card, PageTitle, SourceBadge, TierBadge } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";

const EMAIL_TONE = { valid: "green", accept_all: "amber", invalid: "red", unknown: "neutral" } as const;

type RunResult = { queries: string[]; companies: unknown[]; filtered: unknown[]; dropped: { name: string; reason: string }[]; mode: string };

function RunDiscovery({ onDone }: { onDone: (r: RunResult) => void }) {
  const { ws, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = Boolean(ws?.icp?.approvedAt);
  const run = async () => {
    setBusy(true); setError(null);
    try { onDone(await api<RunResult>("/api/discover", { method: "POST" })); await refresh(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <div className="flex items-center gap-3">
      {error && <span className="text-[12px] text-danger">{error}</span>}
      {!ready && <span className="text-[12px] text-muted">Approve the ICP first</span>}
      <Button variant={ws?.companies.length ? "secondary" : "primary"} onClick={run} disabled={busy || !ready}>{busy ? "Discovering…" : "Run discovery"}</Button>
      {Boolean(ws?.companies.length) && <EnrichButton />}
    </div>
  );
}

function EnrichButton() {
  const { ws, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const done = new Set(ws?.leads.map((l) => l.companyId));
  const todo = ws?.companies.filter((c) => !c.excluded && !done.has(c.id)).length ?? 0;
  const run = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api<{ enriched: number; sources: { hunter: number; apollo: number } }>("/api/enrich", { method: "POST", body: {} }); setMsg(`${r.enriched} enriched · Hunter ${r.sources.hunter} calls, Apollo ${r.sources.apollo}`); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); await refresh(); }
  };
  return (
    <>
      {msg && <span className="text-[12px] text-muted">{msg}</span>}
      <Button onClick={run} disabled={busy || todo === 0} title="2 credits per lead">{busy ? "Enriching…" : todo ? `Enrich ${todo} leads` : "All enriched"}</Button>
    </>
  );
}

export default function DiscoveryPage() {
  const { ws } = useWorkspace();
  const [last, setLast] = useState<RunResult | null>(null);
  if (!ws?.companies.length) return (<div><PageTitle kicker="Discovery" title="Cited companies"><RunDiscovery onDone={setLast} /></PageTitle><EmptyState what="companies" /></div>);
  const rows = [...ws.companies].sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.score - a.score);
  return (
    <div>
      <PageTitle kicker="Discovery" title="Cited companies"><RunDiscovery onDone={setLast} /></PageTitle>
      {last && (
        <Card className="mb-4 p-3 text-[12px]">
          <div><span className="font-semibold">{last.companies.length}</span> cited companies, <span className="font-semibold">{last.filtered.length}</span> filtered, <span className="font-semibold">{last.dropped.length}</span> dropped for missing citations · {last.mode} mode</div>
          {last.dropped.map((d) => <div key={d.name} className="mt-1 text-danger">Dropped {d.name}: {d.reason}</div>)}
          <details className="mt-1 text-muted"><summary className="cursor-pointer">{last.queries.length} search queries</summary>{last.queries.map((q) => <div key={q} className="font-mono text-[11px]">{q}</div>)}</details>
        </Card>
      )}
      <Card className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 bg-paper text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>{["Score", "Fit / Intent", "Company", "Size", "HQ", "Signals", "Buyer", "Email", "LinkedIn", "Sources"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => {
              const signals = ws.signals.filter((s) => s.companyId === c.id);
              const buyer = ws.people.find((p) => p.companyId === c.id);
              const cites = ws.citations.filter((x) => x.entityId === c.id || signals.some((s) => s.id === x.entityId));
              const urls = [...new Set(cites.map((x) => x.url))];
              return (
                <tr key={c.id} className={`hover:bg-paper ${c.excluded ? "opacity-60" : ""}`}>
                  <td className="px-3 py-1.5">{c.excluded ? <Badge tone="red" title={c.excludeReason ?? ""}>Filtered</Badge> : <TierBadge tier={c.tier} score={c.score} />}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-muted">{c.fitScore} / {c.intentScore}</td>
                  <td className="px-3 py-1.5 font-medium">{c.name}<div className="font-mono text-[11px] font-normal text-muted">{c.domain}</div><div className="text-[11px] font-normal text-muted">{c.industry}</div>{c.excluded && <div className="text-[11px] font-normal text-danger">{c.excludeReason}</div>}</td>
                  <td className="px-3 py-1.5 font-mono text-[12px]">{c.headcount}</td>
                  <td className="px-3 py-1.5">{c.hq ?? <span className="text-muted">–</span>}{c.hqSource && <div className="mt-0.5"><SourceBadge source={c.hqSource} /></div>}</td>
                  <td className="min-w-[220px] px-3 py-1.5 text-[12px]">{signals.map((s) => <div key={s.id}>{s.summary}</div>)}</td>
                  <td className="px-3 py-1.5">{buyer ? <>{buyer.name}<div className="text-[11px] text-muted">{buyer.title}</div></> : "–"}</td>
                  <td className="px-3 py-1.5">{buyer && <div className="space-y-0.5"><Badge tone={EMAIL_TONE[buyer.emailStatus]} title={`${buyer.email ?? "no email"} · MX: ${buyer.mx ? "yes" : "no"} · source: ${buyer.emailSource ?? "none"}`}>{buyer.emailStatus.replace("_", "-")}</Badge><div><SourceBadge source={buyer.emailSource} /></div></div>}</td>
                  <td className="px-3 py-1.5">{buyer?.linkedinUrl ? <div className="space-y-0.5"><a className="text-accent hover:underline" href={buyer.linkedinUrl} target="_blank" rel="noreferrer">profile</a><div><SourceBadge source={buyer.linkedinSource} title={buyer.linkedinUrl} /></div></div> : <span className="text-muted">–</span>}</td>
                  <td className="px-3 py-1.5 text-[12px]">{urls.map((u, i) => <a key={u} href={u} title={u} target="_blank" rel="noreferrer" className="mr-1 text-accent hover:underline">[{i + 1}]</a>)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      <h2 className="mt-8 mb-3 font-serif text-xl">Competitor map</h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ws.competitors.map((c) => (
          <Card key={c.id} className="p-4 text-[13px]">
            <div className="flex items-center justify-between"><span className="font-medium">{c.name}</span><Badge>{c.category.replace("_", " ")}</Badge></div>
            <p className="mt-1 text-muted">{c.positioning}</p>
            <p className="mt-2 text-[12px]"><span className="text-muted">Pricing:</span> {c.pricing}</p>
            <p className="mt-1 text-[12px]"><span className="text-muted">Our advantage:</span> {c.ourAdvantage}</p>
            <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block text-[12px] text-accent hover:underline">[1] {new URL(c.sourceUrl).hostname}</a>
          </Card>
        ))}
      </div>
    </div>
  );
}
