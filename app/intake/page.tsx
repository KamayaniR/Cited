"use client";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Badge, Card, ConfidenceBar, PageTitle } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";
import { StageNote } from "@/components/StageNote";

export default function IntakePage() {
  const { ws } = useWorkspace();
  if (!ws?.product || !ws.icp) return (<div><PageTitle kicker="Intake & ICP" title="Describe the product" /><EmptyState what="product" /></div>);
  const { product, icp, expansions } = ws;
  return (
    <div>
      <PageTitle kicker="Intake & ICP" title={product.name}>
        {icp.approvedAt ? <Badge tone="green">ICP v{icp.version} approved</Badge> : <Badge tone="amber">Awaiting approval</Badge>}
      </PageTitle>
      <StageNote stage="P1">Chat and form intake, live ICP inference and accept/adjust/dismiss controls are built next. This view shows the demo ICP.</StageNote>
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-4 text-[13px]">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">Product</div>
          <p className="mt-2">{product.description}</p>
          <dl className="mt-4 space-y-1.5 text-[12px]">
            <div><dt className="inline text-muted">Customers: </dt><dd className="inline">{product.customers}</dd></div>
            <div><dt className="inline text-muted">Pricing: </dt><dd className="inline">{product.pricing}</dd></div>
            <div><dt className="inline text-muted">Team: </dt><dd className="inline">{product.teamBackground}</dd></div>
            <div><dt className="inline text-muted">Regions: </dt><dd className="inline">{product.regions.join(", ")} (excluding {product.excludeRegions.join(", ")})</dd></div>
          </dl>
        </Card>
        <Card className="p-4">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">ICP</div>
          <table className="mt-2 w-full text-[13px]">
            <tbody className="divide-y divide-line">
              {icp.data.industries.map((i) => <tr key={i.naics}><td className="py-1.5">{i.name} <span className="font-mono text-[11px] text-muted">NAICS {i.naics}</span></td><td><ConfidenceBar value={i.confidence} /></td></tr>)}
              <tr><td className="py-1.5">{icp.data.companySize.value.minEmployees}–{icp.data.companySize.value.maxEmployees} employees</td><td><ConfidenceBar value={icp.data.companySize.confidence} /></td></tr>
              {icp.data.personas.map((p) => <tr key={p.title}><td className="py-1.5">Persona: {p.title}</td><td><ConfidenceBar value={p.confidence} /></td></tr>)}
              {icp.data.triggers.map((t) => <tr key={t.signal}><td className="py-1.5">Trigger: {t.signal}</td><td><ConfidenceBar value={t.confidence} /></td></tr>)}
            </tbody>
          </table>
          <div className="mt-3 text-[12px] text-muted">Negative filters: {icp.data.negativeSignals.join("; ")}</div>
        </Card>
      </div>
      <h2 className="mt-8 mb-3 font-serif text-xl">Expansion segments</h2>
      {expansions.map((e) => (
        <Card key={e.id} className="p-4 text-[13px]">
          <div className="flex items-center justify-between"><div className="font-medium">{e.segment}</div><Badge tone={e.status === "accepted" ? "green" : "neutral"}>{e.status}</Badge></div>
          <p className="mt-1 text-muted">{e.rationale}</p>
          <div className="mt-2 text-[12px]">{e.evidence.map((ev, i) => <a key={ev.url} href={ev.url} className="text-accent hover:underline" target="_blank" rel="noreferrer">[{i + 1}] {new URL(ev.url).hostname}</a>)}</div>
        </Card>
      ))}
    </div>
  );
}
