"use client";
import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Card, PageTitle } from "@/components/ui";
import { IntakeForm } from "@/components/IntakeForm";
import { IcpPanel } from "@/components/IcpPanel";

export default function IntakePage() {
  const { ws, refresh } = useWorkspace();
  return (
    <div>
      <PageTitle kicker="Intake & ICP" title={ws?.product ? ws.product.name : "Describe the product"}>
        {ws?.icp?.approvedAt && <Link href="/discovery" className="text-[13px] text-accent hover:underline">Next: run discovery →</Link>}
      </PageTitle>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <IntakeForm onDone={refresh} />
          {ws?.product && (
            <Card className="mt-4 p-4 text-[13px]">
              <div className="flex items-center justify-between"><div className="text-[12px] font-semibold uppercase tracking-wider text-muted">Current product</div><Badge>{ws.product.name}</Badge></div>
              <p className="mt-2 text-muted">{ws.product.description}</p>
            </Card>
          )}
        </div>
        <div>{ws?.icp ? <IcpPanel ws={ws} refresh={refresh} /> : <Card className="p-6 text-[13px] text-muted">Your ICP appears here, with a confidence score on every field.</Card>}</div>
      </div>
    </div>
  );
}
