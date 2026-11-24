"use client";
import { useState } from "react";
import Link from "next/link";
import { Search, Sparkles, Users, Linkedin, MailCheck, MailWarning, MailX, Mail, MapPin, Swords, Ban, ExternalLink } from "lucide-react";
import { api } from "@/components/api";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { RefreshButton } from "@/components/RefreshButton";
import { EmptyState } from "@/components/EmptyState";
import { Avatar, Badge, Button, Card, PageTitle, ScoreRing, SectionTitle, SourceBadge, Toast } from "@/components/ui";
import { Tip } from "@/components/Tip";
import { SignalChip } from "@/components/signals";
import type { Person } from "@/lib/types";

type RunResult = { moss?: { indexed: number; triggerMatches: number; ms: number }; queries: string[]; companies: unknown[]; filtered: unknown[]; dropped: { name: string; reason: string }[]; mode: string };

const EMAIL: Record<Person["emailStatus"], { icon: typeof Mail; cls: string; label: string }> = {
  valid: { icon: MailCheck, cls: "text-tier-a", label: "Verified" },
  accept_all: { icon: MailWarning, cls: "text-tier-b", label: "Accept-all domain" },
  invalid: { icon: MailX, cls: "text-danger", label: "Invalid" },
  unknown: { icon: Mail, cls: "text-tier-c", label: "Unknown" },
};

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
    <>
      {error && <Toast tone="red">{error}</Toast>}
      <Tip content={ready ? "Search for companies that match the approved ICP. Each lead must cite a page search returned." : "Approve the ICP first"}>
        <Button variant={ws?.companies.length ? "secondary" : "primary"} icon={Search} onClick={run} disabled={busy || !ready}>{busy ? "Discovering…" : "Run discovery"}</Button>
      </Tip>
      {Boolean(ws?.companies.length) && <RefreshButton />}
      {Boolean(ws?.companies.length) && <EnrichButton />}
    </>
  );
}

function EnrichButton() {
  const { ws, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const done = new Set(ws?.leads.map((l) => l.companyId));
  const todo = ws?.companies.filter((c) => !c.excluded && !done.has(c.id)).length ?? 0;
  const broke = (ws?.org.creditsBalance ?? 0) < 2;
  const run = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api<{ enriched: number; sources: { hunter: number; apollo: number } }>("/api/enrich", { method: "POST", body: {} }); setMsg(`${r.enriched} enriched · Hunter ${r.sources.hunter} calls, Apollo ${r.sources.apollo}`); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); await refresh(); }
  };
  return (
    <>
      {msg && <Toast>{msg}</Toast>}
      {broke && todo > 0 && <Link href="/billing"><Badge tone="red">Out of credits · top up</Badge></Link>}
      <Tip content="Find the buyer, verify email and MX with Hunter, fill LinkedIn, HQ and history from Apollo. 2 credits per lead.">
        <Button icon={Users} onClick={run} disabled={busy || todo === 0 || broke}>{busy ? "Enriching…" : todo ? `Enrich ${todo} leads` : "All enriched"}</Button>
      </Tip>
    </>
  );
}

export default function DiscoveryPage() {
  const { ws } = useWorkspace();
  const [last, setLast] = useState<RunResult | null>(null);
  const header = <PageTitle icon={Search} title="Discovery" tip="Companies that fit the ICP. Every lead and signal links to the page search returned; leads without a source are dropped, and negative signals filter a company out."><RunDiscovery onDone={setLast} /></PageTitle>;
  if (!ws?.companies.length) return <div>{header}<EmptyState what="companies" /></div>;
  const rows = [...ws.companies].sort((a, b) => Number(a.excluded) - Number(b.excluded) || b.score - a.score);

  return (
    <div>
      {header}
      {last && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Badge tone="green" icon={Sparkles}>{last.companies.length} cited</Badge>
          {last.filtered.length > 0 && <Badge tone="red" icon={Ban}>{last.filtered.length} filtered</Badge>}
          {last.dropped.length > 0 && <Badge tone="amber" title={last.dropped.map((d) => `${d.name}: ${d.reason}`).join("\n")}>{last.dropped.length} dropped (no source)</Badge>}
          {last.moss && <Badge tone="violet" title={`Moss indexed ${last.moss.indexed} evidence docs and matched ${last.moss.triggerMatches} signals to ICP triggers by meaning`}>Moss · {last.moss.ms.toFixed(1)} ms</Badge>}
          <Badge title={last.queries.join("\n")}>{last.queries.length} queries · {last.mode}</Badge>
        </div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="text-left text-[10px] tracking-wider text-muted uppercase">
            <tr className="border-b border-line">{["", "Company", "Signals", "Buyer", "Email", "In", "Sources"].map((h, i) => <th key={i} className="px-3 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((c) => {
              const signals = ws.signals.filter((s) => s.companyId === c.id);
              const buyer = ws.people.find((p) => p.companyId === c.id);
              const cites = ws.citations.filter((x) => x.entityId === c.id || signals.some((s) => s.id === x.entityId));
              const urls = [...new Set(cites.map((x) => x.url))];
              const e = buyer ? EMAIL[buyer.emailStatus] : null;
              return (
                <tr key={c.id} className={`hover:bg-paper ${c.excluded ? "bg-danger/[0.02]" : ""}`}>
                  <td className="w-12 px-3 py-2">
                    {c.excluded ? <Tip content={`Filtered: ${c.excludeReason ?? ""}`}><span className="grid h-[34px] w-[34px] place-items-center rounded-full bg-danger/10 text-danger" aria-label="Filtered"><Ban size={15} /></span></Tip>
                      : <ScoreRing tier={c.tier} score={c.score} fit={c.fitScore} intent={c.intentScore} />}
                  </td>
                  <td className={`px-3 py-2 ${c.excluded ? "opacity-60" : ""}`}>
                    <Tip content={`${c.domain}\n${c.industry} · NAICS ${c.naics}\n${c.headcount.toLocaleString()} employees`}>
                      <span className="font-medium">{c.name}</span>
                    </Tip>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                      <span className="inline-flex items-center gap-0.5"><Users size={11} />{c.headcount.toLocaleString()}</span>
                      {c.hq && <Tip content={`HQ: ${c.hq}${c.hqSource ? ` (source: ${c.hqSource})` : ""}`}><span className="inline-flex items-center gap-0.5"><MapPin size={11} />{c.hq.split(",")[0]}</span></Tip>}
                      {c.excluded && <span className="text-danger">{c.excludeReason?.replace(/^Negative signal:\s*/i, "")}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2"><div className="flex flex-wrap gap-1">{signals.map((s) => <SignalChip key={s.id} s={s} />)}</div></td>
                  <td className="px-3 py-2">
                    {buyer ? (
                      <div className="flex items-center gap-2">
                        <Avatar name={buyer.name} title={buyer.previouslyAt?.length ? `Previously at ${buyer.previouslyAt.join(", ")}` : undefined} />
                        <div className="leading-tight"><div className="text-[12px] font-medium">{buyer.name}</div><div className="max-w-[140px] truncate text-[11px] text-muted">{buyer.title}</div></div>
                      </div>
                    ) : <span className="text-muted">–</span>}
                  </td>
                  <td className="px-3 py-2">
                    {buyer && e && (
                      <span className="inline-flex items-center gap-1.5">
                        <Tip content={`${e.label}${buyer.email ? `\n${buyer.email}` : ""}\nMX: ${buyer.mx ? "yes" : "no"}`}><e.icon size={16} className={e.cls} aria-label={e.label} /></Tip>
                        <SourceBadge source={buyer.emailSource} />
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {buyer?.linkedinUrl ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Tip content={buyer.linkedinUrl}><a href={buyer.linkedinUrl} target="_blank" rel="noreferrer" aria-label="LinkedIn profile" className="text-rep hover:opacity-70"><Linkedin size={15} /></a></Tip>
                        <SourceBadge source={buyer.linkedinSource} />
                      </span>
                    ) : <span className="text-muted">–</span>}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      {urls.map((u, i) => <Tip key={u} content={u}><a href={u} target="_blank" rel="noreferrer" className="grid h-5 min-w-5 place-items-center rounded-[4px] bg-accent/10 px-1 font-mono text-[10px] text-accent hover:bg-accent hover:text-white">{i + 1}</a></Tip>)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="mt-6">
        <SectionTitle icon={Swords} tip="Who else the buyer might pick, and why Cited's product wins. Each card cites the competitor's own site.">Competitors</SectionTitle>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {ws.competitors.map((c) => {
            let host = ""; try { host = new URL(c.sourceUrl).hostname; } catch { /* ignore */ }
            return (
              <Tip key={c.id} className="block" content={`${c.positioning}\nPricing: ${c.pricing}`}>
                <Card className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{c.name}</span>
                    <Badge tone={c.category === "direct" ? "red" : c.category === "adjacent" ? "amber" : "neutral"}>{c.category.replace("_", " ")}</Badge>
                  </div>
                  <div className="mt-2 flex items-start gap-1.5 text-[12px]"><Sparkles size={13} className="mt-0.5 shrink-0 text-tier-a" /><span className="line-clamp-2">{c.ourAdvantage}</span></div>
                  <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"><ExternalLink size={11} />{host}</a>
                </Card>
              </Tip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
