"use client";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { ActorTag, Badge, Card, PageTitle, TierBadge } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { StageNote } from "@/components/StageNote";
import { STAGES, STAGE_LABELS } from "@/lib/types";

export default function PipelinePage() {
  const { ws } = useWorkspace();
  if (!ws?.leads.length) return (<div><PageTitle kicker="Pipeline" title="Leads by stage" /><EmptyState what="leads" /></div>);
  return (
    <div>
      <PageTitle kicker="Pipeline" title="Leads by stage" />
      <StageNote stage="P3">Drag between stages with rep attribution, the won/lost close modal and analytics come in P3.</StageNote>
      <div className="grid grid-cols-5 gap-3 overflow-x-auto">
        {STAGES.map((stage) => {
          const leads = ws.leads.filter((l) => l.stage === stage);
          return (
            <div key={stage} className="min-w-[200px]">
              <div className="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-muted"><span>{STAGE_LABELS[stage]}</span><span className="font-mono">{leads.length}</span></div>
              <div className="space-y-2">
                {leads.map((l) => {
                  const c = ws.companies.find((x) => x.id === l.companyId)!;
                  const p = ws.people.find((x) => x.id === l.personId);
                  return (
                    <Card key={l.id} className="p-3 text-[13px]">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-[12px] text-muted">{p?.name}</div>
                      <div className="mt-2 flex gap-1.5"><TierBadge tier={c.tier} score={c.score} /><ActorTag actor={l.owner} />{l.outcome && <Badge tone={l.outcome === "won" ? "green" : "red"}>{l.outcome}</Badge>}</div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
