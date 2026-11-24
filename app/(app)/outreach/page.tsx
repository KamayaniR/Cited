"use client";
import { useState } from "react";
import { Inbox, PenLine, Linkedin, ListChecks, Mail } from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Avatar, Badge, Button, Card, PageTitle, ScoreRing, Segmented, Toast } from "@/components/ui";
import { Tip } from "@/components/Tip";
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
      {ws && Object.entries(byLead).map(([leadId, ms]) => {
        const lead = ws.leads.find((l) => l.id === leadId)!;
        const company = ws.companies.find((c) => c.id === lead.companyId)!;
        const person = ws.people.find((p) => p.id === lead.personId)!;
        const signals = ws.signals.filter((s) => s.companyId === company.id);
        return (
          <Card key={leadId} className="mb-4 p-3.5">
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <ScoreRing tier={company.tier} score={company.score} fit={company.fitScore} intent={company.intentScore} size={30} />
              <Avatar name={person.name} />
              <div className="leading-tight"><div className="text-[13px] font-medium">{person.name}</div><div className="text-[11px] text-muted">{person.title} · {company.name}</div></div>
              <span className="ml-auto flex gap-1">
                <Tip content="A/B variant of the sequence"><Badge>Variant {lead.variant}</Badge></Tip>
                <Badge tone={lead.stage === "matched" ? "neutral" : "green"}>{lead.stage.replace("_", " ")}</Badge>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {ms!.sort((a, b) => a.step - b.step).map((m) => <MessageCard key={m.id} m={m} person={person} signals={signals} refresh={refresh} />)}
            </div>
            <EvidenceSearch companyId={company.id} companyName={company.name} />
          </Card>
        );
      })}
      {ws?.messages.length && !msgs.length ? <Card className="p-6 text-center text-[13px] text-muted">Nothing here</Card> : null}
    </div>
  );
}
