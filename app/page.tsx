"use client";
import Link from "next/link";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Button, Card, PageTitle } from "@/components/ui";

const LOOP = [
  { n: 1, label: "Intake → ICP, human approves", href: "/intake" },
  { n: 2, label: "Discovery, citation check, negative filter, scoring", href: "/discovery" },
  { n: 3, label: "Graph write and multi-hop queries", href: "/graph" },
  { n: 4, label: "Enrichment (Hunter, Apollo fallback), credit gated", href: "/discovery" },
  { n: 5, label: "Draft sequence, Reviewer and Security checks", href: "/outreach" },
  { n: 6, label: "Human approves, edits or rejects", href: "/outreach" },
  { n: 7, label: "Send to demo inbox, stage update, analytics", href: "/pipeline" },
];

export default function Overview() {
  const { ws, loading, loadDemo, reset } = useWorkspace();
  const stats = ws ? [
    { label: "Companies", value: ws.companies.filter((c) => !c.excluded).length },
    { label: "Filtered", value: ws.companies.filter((c) => c.excluded).length },
    { label: "Leads", value: ws.leads.length },
    { label: "Awaiting approval", value: ws.messages.filter((m) => m.status === "pending_approval").length },
    { label: "Citations", value: ws.citations.length },
  ] : [];

  return (
    <div>
      <PageTitle kicker="Overview" title="From product description to booked meetings">
        <div className="flex gap-2">
          <Button variant="secondary" onClick={reset} disabled={loading}>Reset</Button>
          <Button onClick={loadDemo} disabled={loading}>Load demo data</Button>
        </div>
      </PageTitle>
      <div className="grid grid-cols-5 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-[12px] text-muted">{s.label}</div>
            <div className="mt-1 font-serif text-2xl">{s.value}</div>
          </Card>
        ))}
      </div>
      <h2 className="mt-8 mb-3 font-serif text-xl">The loop</h2>
      <Card>
        <ol className="divide-y divide-line">
          {LOOP.map((s) => (
            <li key={s.n} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className="font-mono text-[11px] text-muted">{s.n}</span>
              <Link href={s.href} className="hover:text-accent hover:underline">{s.label}</Link>
            </li>
          ))}
        </ol>
      </Card>
      <p className="mt-4 text-[12px] text-muted">Every claim is cited, every message is approved by a human, and nothing is ever emailed to a real prospect outside production.</p>
    </div>
  );
}
