"use client";
import { useState } from "react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { ActorTag, Card, PageTitle } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";

export default function AuditPage() {
  const { ws } = useWorkspace();
  const [actor, setActor] = useState("all");
  const [action, setAction] = useState("all");
  if (!ws?.auditLog.length) return (<div><PageTitle kicker="Audit log" title="Every action, with who did it" /><EmptyState what="audit entries" /></div>);
  const rows = ws.auditLog.filter((a) => (actor === "all" || a.actor === actor) && (action === "all" || a.action === action));
  return (
    <div>
      <PageTitle kicker="Audit log" title="Every action, with who did it">
        <div className="flex gap-2 text-[13px]">
          <select aria-label="Filter by actor" value={actor} onChange={(e) => setActor(e.target.value)} className="rounded-[6px] border border-line bg-white px-2 py-1">
            <option value="all">All actors</option><option value="agent">agent</option><option value="rep">rep</option>
          </select>
          <select aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} className="rounded-[6px] border border-line bg-white px-2 py-1">
            <option value="all">All actions</option>
            {[...new Set(ws.auditLog.map((a) => a.action))].sort().map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </PageTitle>
      <div className="mb-2 text-[12px] text-muted">{rows.length} of {ws.auditLog.length} entries</div>
      <Card>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted"><tr>{["When", "Actor", "Via", "Action", "Target", "Detail"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-1.5 font-mono text-[11px] text-muted">{new Date(a.at).toLocaleString()}</td>
                <td className="px-3 py-1.5"><ActorTag actor={a.actor} /></td>
                <td className="px-3 py-1.5 text-muted">{a.agent}</td>
                <td className="px-3 py-1.5">{a.action}</td>
                <td className="px-3 py-1.5 font-mono text-[11px]">{a.target}</td>
                <td className="px-3 py-1.5">{a.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
