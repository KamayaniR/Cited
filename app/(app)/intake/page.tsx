"use client";
import Link from "next/link";
import { ArrowRight, MessageSquareText, Package, Target } from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Card, PageTitle } from "@/components/ui";
import { Tip } from "@/components/Tip";
import { IntakeForm } from "@/components/IntakeForm";
import { IcpPanel } from "@/components/IcpPanel";

export default function IntakePage() {
  const { ws, refresh } = useWorkspace();
  return (
    <div>
      <PageTitle icon={MessageSquareText} title={ws?.product ? ws.product.name : "Describe the product"} tip="Describe what you sell. Cited infers the ICP (NAICS codes, size, regions, personas, buying triggers), each with a confidence score, and you approve it before discovery.">
        {ws?.icp?.approvedAt && <Link href="/discovery" className="inline-flex items-center gap-1 rounded-[6px] bg-accent/10 px-3 py-1.5 text-[13px] font-medium text-accent hover:bg-accent/15">Discovery<ArrowRight size={14} /></Link>}
      </PageTitle>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0">
          <IntakeForm onDone={refresh} />
          {ws?.product && (
            <Tip className="mt-3 block" content={ws.product.description}>
              <Card className="flex items-center gap-2.5 p-3 text-[13px]">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[7px] bg-accent/10 text-accent"><Package size={15} /></span>
                <div className="min-w-0"><div className="font-medium">{ws.product.name}</div><div className="truncate text-[12px] text-muted">{ws.product.description}</div></div>
              </Card>
            </Tip>
          )}
        </div>
        <div className="min-w-0">{ws?.icp ? <IcpPanel ws={ws} refresh={refresh} /> : <Card className="grid place-items-center gap-2 p-10 text-[13px] text-muted"><Target size={20} />Your ICP appears here</Card>}</div>
      </div>
    </div>
  );
}
