"use client";
import Link from "next/link";
import { Building2, Filter, Users, Inbox, Link2, MessageSquareText, Search, Share2, Mail, UserCheck, KanbanSquare, RotateCcw, Database, ChevronRight } from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Button, Card, Donut, PageTitle, SectionTitle, Stat, BarRow } from "@/components/ui";
import type { Stage } from "@/lib/types";

const LOOP = [
  { icon: MessageSquareText, label: "Intake", href: "/intake", tip: "Product → ICP, a human approves" },
  { icon: Search, label: "Discover", href: "/discovery", tip: "Cited companies, negative filter, scoring" },
  { icon: Share2, label: "Graph", href: "/graph", tip: "Multi-hop warm paths" },
  { icon: Users, label: "Enrich", href: "/discovery", tip: "Hunter, Apollo fallback, credit gated" },
  { icon: Mail, label: "Draft", href: "/outreach", tip: "Sequence, claim check, reviewer and security" },
  { icon: UserCheck, label: "Approve", href: "/outreach", tip: "You approve, edit or reject" },
  { icon: KanbanSquare, label: "Track", href: "/pipeline", tip: "Send to demo inbox, stage update, analytics" },
];
const STAGES: { stage: Stage; label: string }[] = [
  { stage: "matched", label: "Matched" }, { stage: "contacted", label: "Contacted" }, { stage: "replied", label: "Replied" }, { stage: "meeting_booked", label: "Meeting" }, { stage: "closed_lost", label: "Closed" },
];

export default function Overview() {
  const { ws, loading, loadDemo, reset } = useWorkspace();
  const live = ws?.companies.filter((c) => !c.excluded) ?? [];
  const tiers = { A: live.filter((c) => c.tier === "A").length, B: live.filter((c) => c.tier === "B").length, C: live.filter((c) => c.tier === "C").length };
  const pending = ws?.messages.filter((m) => m.status === "pending_approval" || m.status === "needs_fix").length ?? 0;
  const byStage = STAGES.map((s) => ({ ...s, n: ws?.leads.filter((l) => l.stage === s.stage).length ?? 0 }));
  const maxStage = Math.max(1, ...byStage.map((s) => s.n));
  const steps = ws ? [Boolean(ws.icp), live.length > 0, live.length > 0, ws.people.length > 0, ws.messages.length > 0, ws.messages.some((m) => m.status === "sent"), ws.leads.some((l) => l.stage !== "matched")] : [];

  return (
    <div>
      <PageTitle icon={Database} title="Overview" tip="From product description to booked meetings. Every claim is cited, every message is approved by a human, and nothing is emailed to a real prospect outside production.">
        <Button variant="secondary" icon={RotateCcw} onClick={reset} disabled={loading}>Reset</Button>
        <Button onClick={loadDemo} disabled={loading}>Load demo data</Button>
      </PageTitle>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={Building2} label="Companies" value={live.length} />
        <Stat icon={Filter} label="Filtered" value={ws?.companies.filter((c) => c.excluded).length ?? 0} tone="red" tip="Dropped by a negative signal, such as a hiring freeze" />
        <Stat icon={Users} label="Leads" value={ws?.leads.length ?? 0} tone="blue" />
        <Stat icon={Inbox} label="To approve" value={pending} tone="amber" />
        <Stat icon={Link2} label="Citations" value={ws?.citations.length ?? 0} tone="green" tip="Source URLs behind leads and signals" />
      </div>

      <Card className="mt-4 p-4">
        <SectionTitle>The loop</SectionTitle>
        <ol className="flex flex-wrap items-center gap-1">
          {LOOP.map((s, i) => (
            <li key={s.label} className="flex items-center gap-1">
              <Link href={s.href} title={s.tip} className={`flex items-center gap-2 rounded-[8px] border px-3 py-2 text-[12px] font-medium transition hover:border-accent ${steps[i] ? "border-tier-a/30 bg-tier-a/5 text-tier-a" : "border-line bg-white text-muted"}`}>
                <s.icon size={15} />{s.label}
              </Link>
              {i < LOOP.length - 1 && <ChevronRight size={14} className="text-line" />}
            </li>
          ))}
        </ol>
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-5 p-4">
          <Donut segments={[{ name: "Tier A", value: tiers.A, color: "#059669" }, { name: "Tier B", value: tiers.B, color: "#D97706" }, { name: "Tier C", value: tiers.C, color: "#9CA3AF" }]} label={<><b className="text-[18px]">{live.length}</b><br /><span className="text-muted">cos</span></>} />
          <ul className="space-y-1.5 text-[12px]">
            {(["A", "B", "C"] as const).map((t) => <li key={t} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${t === "A" ? "bg-tier-a" : t === "B" ? "bg-tier-b" : "bg-tier-c"}`} />Tier {t}<b className="ml-2">{tiers[t]}</b></li>)}
          </ul>
        </Card>
        <Card className="p-4">
          <SectionTitle icon={KanbanSquare}>Pipeline</SectionTitle>
          <div className="space-y-2">{byStage.map((s) => <BarRow key={s.stage} label={s.label} value={s.n} max={maxStage} tone={s.stage === "meeting_booked" ? "green" : s.stage === "closed_lost" ? "neutral" : "accent"} />)}</div>
        </Card>
      </div>
    </div>
  );
}
