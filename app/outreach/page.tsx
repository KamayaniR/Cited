"use client";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Card, PageTitle } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { StageNote } from "@/components/StageNote";

export default function OutreachPage() {
  const { ws } = useWorkspace();
  const pending = ws?.messages.filter((m) => m.status === "pending_approval") ?? [];
  if (!ws || !ws.messages.length) return (<div><PageTitle kicker="Approval queue" title="Nothing sends without you" /><EmptyState what="drafts" /></div>);
  const byLead = Object.groupBy(pending, (m) => m.leadId);
  return (
    <div>
      <PageTitle kicker="Approval queue" title="Nothing sends without you"><Badge tone="amber">{pending.length} awaiting approval</Badge></PageTitle>
      <StageNote stage="P2">Approve, edit and reject, the demo-inbox send and the manual LinkedIn flow are built in P2. Drafts are read-only here.</StageNote>
      {Object.entries(byLead).map(([leadId, msgs]) => {
        const lead = ws.leads.find((l) => l.id === leadId)!;
        const company = ws.companies.find((c) => c.id === lead.companyId)!;
        const person = ws.people.find((p) => p.id === lead.personId)!;
        return (
          <Card key={leadId} className="mb-4 p-4">
            <div className="mb-3 flex items-center gap-2 text-[13px]"><span className="font-medium">{person.name}</span><span className="text-muted">{person.title}, {company.name}</span><Badge>variant {lead.variant}</Badge></div>
            <div className="grid grid-cols-3 gap-3">
              {msgs!.sort((a, b) => a.dayOffset - b.dayOffset).map((m) => {
                const sig = ws.signals.filter((s) => m.signalIds.includes(s.id));
                return (
                  <div key={m.id} className="rounded-[6px] border border-line p-3 text-[12px]">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Badge tone={m.channel === "email" ? "neutral" : "blue"}>{m.channel} · touch {m.step} · day {m.dayOffset}</Badge>
                      {m.channel === "linkedin" && <Badge tone="amber">LinkedIn: send manually</Badge>}
                    </div>
                    {m.subject && <div className="font-medium">{m.subject}</div>}
                    <p className="mt-1 whitespace-pre-line">{m.body}</p>
                    {sig.map((s) => <a key={s.id} href={s.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 block text-accent hover:underline">Signal: {s.summary}</a>)}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
