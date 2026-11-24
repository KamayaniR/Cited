"use client";
import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { Message } from "@/lib/types";
import { Inbox, PenLine, Linkedin, ListChecks, Mail } from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Avatar, Badge, Button, Card, PageTitle, ScoreRing, Segmented, Toast } from "@/components/ui";
import { MessageCard } from "@/components/MessageCard";
import { api } from "@/components/api";
import { useRun } from "@/components/run/RunProvider";
import { EvidenceSearch } from "@/components/EvidenceSearch";
import { ApprovalCards, CheckBandButton } from "@/components/ApprovalCards";

const FILTERS = {
  open: (s: string) => s === "pending_approval" || s === "needs_fix",
  linkedin: (s: string, ch: string) => ch === "linkedin" && s === "approved",
  all: () => true,
} as const;
type F = keyof typeof FILTERS;

export default function OutreachPage() {
  const { ws, refresh } = useWorkspace();
  const { track } = useRun();
  const [filter, setFilter] = useState<F>("open");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const undrafted = ws ? ws.leads.filter((l) => l.stage === "matched" && !ws.messages.some((m) => m.leadId === l.id)).length : 0;
  const generate = async () => {
    setBusy(true); setMsg(null);
    try { const r = await track("draft", "draft", () => api<{ messages: unknown[]; batch: string | null }>("/api/outreach/generate", { method: "POST", body: {} })); setMsg(`Batch ${r.batch} · ${r.messages.length} drafted, reviewed, security-checked`); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); await refresh(); }
  };

  const match = FILTERS[filter];
  const msgs = ws?.messages.filter((m) => match(m.status, m.channel)) ?? [];
  const byLead = Object.groupBy(msgs, (m) => m.leadId);
  const count = (k: F) => ws?.messages.filter((m) => FILTERS[k](m.status, m.channel)).length ?? 0;

  return (
    <div>
      <PageTitle icon={Inbox} title="Approval queue" tip="Nothing sends without you. Four agents plan, draft, review and security-check each sequence; every sentence is checked against stored evidence before it reaches you.">
        {msg && <Toast>{msg}</Toast>}
        <CheckBandButton />
        <Button icon={PenLine} onClick={generate} disabled={busy || undrafted === 0}>{busy ? "Drafting…" : undrafted ? `Draft sequences for ${undrafted} leads` : "All leads drafted"}</Button>
      </PageTitle>
      <ApprovalCards />
      <div className="mb-3">
        <Segmented value={filter} onChange={setFilter} options={[
          { value: "open", label: "Needs review", icon: ListChecks, count: count("open") },
          { value: "linkedin", label: "LinkedIn to send", icon: Linkedin, count: count("linkedin") },
          { value: "all", label: "All", icon: Mail },
        ]} />
      </div>
      {!ws?.messages.length && <Card className="grid place-items-center gap-2 p-10 text-[13px] text-muted"><PenLine size={20} />No drafts yet</Card>}
      {ws && Object.entries(byLead).map(([leadId, ms]) => <LeadCard key={leadId} leadId={leadId} ms={ms!} />)}
      {ws?.messages.length && !msgs.length ? <Card className="p-6 text-center text-[13px] text-muted">Nothing here</Card> : null}
    </div>
  );
}

/** One lead: touch 1 up front; later touches and evidence search open on demand. */
function LeadCard({ leadId, ms }: { leadId: string; ms: Message[] }) {
  const { ws, refresh } = useWorkspace();
  const [more, setMore] = useState(false);
  const [ask, setAsk] = useState(false);
  if (!ws) return null;
  const lead = ws.leads.find((l) => l.id === leadId);
  const company = lead && ws.companies.find((c) => c.id === lead.companyId);
  const person = lead && ws.people.find((p) => p.id === lead.personId);
  if (!lead || !company || !person) return null;
  const signals = ws.signals.filter((s) => s.companyId === company.id);
  const sorted = [...ms].sort((a, b) => a.step - b.step);
  const [first, ...rest] = sorted;
  const claims = ms.flatMap((m) => m.review?.grounding?.claims ?? []);
  const okN = claims.filter((c) => c.supported).length;
  const pct = claims.length ? okN / claims.length : 1;
  return (
    <Card className="mb-3 p-3.5">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <ScoreRing tier={company.tier} score={company.score} fit={company.fitScore} intent={company.intentScore} size={30} />
        <Avatar name={person.name} />
        <div className="leading-tight"><div className="text-[13px] font-medium">{person.name}</div><div className="text-[11px] text-muted">{person.title} · {company.name}</div></div>
        {lead.stage !== "matched" && <Badge tone="green">{lead.stage.replace("_", " ")}</Badge>}
        <span className="flex items-center gap-2" title={`${okN} of ${claims.length} claims matched stored evidence`}>
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line"><span className={`c-grow-x block h-full rounded-full ${pct === 1 ? "bg-tier-a" : pct >= 0.75 ? "bg-tier-b" : "bg-danger"}`} style={{ width: `${pct * 100}%` }} /></span>
          <span className="font-mono text-[10.5px] text-muted">{claims.length ? `${okN}/${claims.length} verified` : "verified"}</span>
        </span>
        <span className="ml-auto flex items-center gap-3 text-[12px] text-muted">
          <button onClick={() => setAsk((v) => !v)} className="inline-flex items-center gap-1 hover:text-ink"><Search size={13} />Ask the evidence</button>
          {rest.length > 0 && <button onClick={() => setMore((v) => !v)} aria-expanded={more} className="inline-flex items-center gap-1 hover:text-ink">{more ? "Hide follow-ups" : `Show ${rest.length} follow-up${rest.length > 1 ? "s" : ""}`}<ChevronDown size={13} className={more ? "rotate-180" : ""} /></button>}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {(more ? sorted : [first]).map((m) => <MessageCard key={m.id} m={m} person={person} signals={signals} refresh={refresh} />)}
      </div>
      {ask && <EvidenceSearch companyId={company.id} companyName={company.name} />}
    </Card>
  );
}
