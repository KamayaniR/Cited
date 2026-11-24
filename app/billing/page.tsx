"use client";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Card, PageTitle } from "@/components/ui";
import { StageNote } from "@/components/StageNote";

export default function BillingPage() {
  const { ws } = useWorkspace();
  const usage = ws?.usageEvents ?? [];
  return (
    <div>
      <PageTitle kicker="Billing" title="Credits and usage" />
      <StageNote stage="P5">Flexprice metering, the 402 credit gate and top-up are built in P5.</StageNote>
      <Card className="mb-4 p-4"><div className="text-[12px] text-muted">Balance</div><div className="font-serif text-3xl">{ws?.org.creditsBalance ?? 0} credits</div></Card>
      <Card>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted"><tr>{["When", "Event", "Credits", "Lead", "Synced to Flexprice"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {usage.map((u) => (
              <tr key={u.id}><td className="px-3 py-1.5 font-mono text-[11px] text-muted">{new Date(u.at).toLocaleString()}</td><td className="px-3 py-1.5">{u.eventName}</td><td className="px-3 py-1.5 font-mono">{u.credits}</td><td className="px-3 py-1.5 font-mono text-[11px]">{u.leadId}</td><td className="px-3 py-1.5">{u.flexpriceSynced ? "yes" : "pending"}</td></tr>
            ))}
            {!usage.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">No usage yet.</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
