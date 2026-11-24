"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Button, Card, PageTitle, TierBadge } from "@/components/ui";
import { MessageCard } from "@/components/MessageCard";
import { api } from "@/components/api";
import { EvidenceSearch } from "@/components/EvidenceSearch";
import { ApprovalCards, CheckBandButton } from "@/components/ApprovalCards";

const FILTERS = [
  { key: "open", label: "Needs review", match: (s: string) => s === "pending_approval" || s === "needs_fix" },
  { key: "linkedin", label: "LinkedIn to send", match: (s: string, ch: string) => ch === "linkedin" && s === "approved" },
  { key: "all", label: "All", match: () => true },
] as const;

export default function OutreachPage() {
  const { ws, refresh } = useWorkspace();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const undrafted = ws ? ws.leads.filter((l) => l.stage === "matched" && !ws.messages.some((m) => m.leadId === l.id)).length : 0;
  const generate = async () => {
    setBusy(true); setMsg(null);
    try { const r = await api<{ messages: unknown[]; batch: string | null }>("/api/outreach/generate", { method: "POST", body: {} }); setMsg(`Batch ${r.batch}: ${r.messages.length} messages drafted, reviewed and security-checked`); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); await refresh(); }
  };

  const f = FILTERS.find((x) => x.key === filter)!;
  const msgs = ws?.messages.filter((m) => f.match(m.status, m.channel)) ?? [];
  const byLead = Object.groupBy(msgs, (m) => m.leadId);
  const counts = { open: ws?.messages.filter((m) => FILTERS[0].match(m.status)).length ?? 0, linkedin: ws?.messages.filter((m) => FILTERS[1].match(m.status, m.channel)).length ?? 0 };

  return (
    <div>
      <PageTitle kicker="Approval queue" title="Nothing sends without you">
        <div className="flex items-center gap-3">
          {msg && <span className="text-[12px] text-muted">{msg}</span>}
          <CheckBandButton />
          <Button onClick={generate} disabled={busy || undrafted === 0}>{busy ? "Drafting…" : undrafted ? `Draft sequences for ${undrafted} leads` : "All leads drafted"}</Button>
        </div>
      </PageTitle>
      <ApprovalCards />
      <div className="mb-4 flex gap-1.5">
        {FILTERS.map((x) => (
          <button key={x.key} onClick={() => setFilter(x.key)} className={`rounded-[6px] px-2.5 py-1 text-[12px] ${filter === x.key ? "bg-ink text-white" : "hover:bg-line/50"}`}>
            {x.label}{x.key !== "all" && <span className="ml-1 font-mono">{counts[x.key]}</span>}
          </button>
        ))}
      </div>
      {!ws?.messages.length && <Card className="p-8 text-center text-[13px] text-muted">No drafts yet. Enrich leads on Discovery, then draft sequences here.</Card>}
      {ws && Object.entries(byLead).map(([leadId, ms]) => {
        const lead = ws.leads.find((l) => l.id === leadId)!;
        const company = ws.companies.find((c) => c.id === lead.companyId)!;
        const person = ws.people.find((p) => p.id === lead.personId)!;
        const signals = ws.signals.filter((s) => s.companyId === company.id);
        return (
          <Card key={leadId} className="mb-4 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium">{person.name}</span><span className="text-muted">{person.title}, {company.name}</span>
              <TierBadge tier={company.tier} score={company.score} /><Badge>variant {lead.variant}</Badge><Badge tone={lead.stage === "matched" ? "neutral" : "green"}>{lead.stage.replace("_", " ")}</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {ms!.sort((a, b) => a.step - b.step).map((m) => <MessageCard key={m.id} m={m} person={person} signals={signals} refresh={refresh} />)}
            </div>
            <EvidenceSearch companyId={company.id} companyName={company.name} />
          </Card>
        );
      })}
      {ws?.messages.length && !msgs.length ? <Card className="p-6 text-center text-[13px] text-muted">Nothing here.</Card> : null}
    </div>
  );
}
