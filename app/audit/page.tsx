"use client";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { ActorTag, Card, PageTitle } from "@/components/ui";
import { EmptyState } from "@/components/EmptyState";

export default function AuditPage() {
  const { ws } = useWorkspace();
  if (!ws?.auditLog.length) return (<div><PageTitle kicker="Audit log" title="Every action, with who did it" /><EmptyState what="audit entries" /></div>);
  return (
    <div>
      <PageTitle kicker="Audit log" title="Every action, with who did it" />
      <Card>
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted"><tr>{["When", "Actor", "Via", "Action", "Target", "Detail"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {ws.auditLog.map((a) => (
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
