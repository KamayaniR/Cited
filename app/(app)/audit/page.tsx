"use client";
import { useState } from "react";
import { ScrollText, Bot, User, Send, Check, X, Pencil, KanbanSquare, Search, Users, Coins, Filter, Target, Share2, RefreshCw, Lightbulb, Activity } from "lucide-react";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { Card, PageTitle, Segmented } from "@/components/ui";
import { Tip } from "@/components/Tip";
import { EmptyState } from "@/components/EmptyState";

function actionIcon(a: string) {
  if (/sent/.test(a)) return { icon: Send, cls: "bg-tier-a/10 text-tier-a" };
  if (/approved|accepted/.test(a)) return { icon: Check, cls: "bg-tier-a/10 text-tier-a" };
  if (/reject|fail|filtered|dropped|gated/.test(a)) return { icon: X, cls: "bg-danger/10 text-danger" };
  if (/edit/.test(a)) return { icon: Pencil, cls: "bg-rep/10 text-rep" };
  if (/stage/.test(a)) return { icon: KanbanSquare, cls: "bg-accent/10 text-accent" };
  if (/discover/.test(a)) return { icon: Search, cls: "bg-accent/10 text-accent" };
  if (/enrich|buyer/.test(a)) return { icon: Users, cls: "bg-rep/10 text-rep" };
  if (/credit|flexprice|balance/.test(a)) return { icon: Coins, cls: "bg-tier-b/10 text-tier-b" };
  if (/icp|intake|expansion/.test(a)) return { icon: Target, cls: "bg-accent/10 text-accent" };
  if (/graph/.test(a)) return { icon: Share2, cls: "bg-agent/10 text-agent" };
  if (/refresh|tier/.test(a)) return { icon: RefreshCw, cls: "bg-agent/10 text-agent" };
  if (/signal/.test(a)) return { icon: Lightbulb, cls: "bg-tier-b/10 text-tier-b" };
  return { icon: Activity, cls: "bg-line text-muted" };
}

export default function AuditPage() {
  const { ws } = useWorkspace();
  const [actor, setActor] = useState<"all" | "agent" | "rep">("all");
  const [action, setAction] = useState("all");
  const title = (
    <PageTitle icon={ScrollText} title="Audit log" tip="Every action, who did it (agent or rep) and through what (UI or Band). The source of truth for every outbound message.">
      {ws?.auditLog.length ? (
        <>
          <Segmented value={actor} onChange={setActor} options={[{ value: "all", label: "All" }, { value: "agent", label: "Agent", icon: Bot }, { value: "rep", label: "Rep", icon: User }]} />
          <label className="flex items-center gap-1.5 rounded-[8px] border border-line bg-white px-2 py-1 text-[12px]">
            <Filter size={13} className="text-muted" />
            <select aria-label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)} className="bg-transparent outline-none">
              <option value="all">All actions</option>
              {[...new Set(ws.auditLog.map((a) => a.action))].sort().map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
            </select>
          </label>
        </>
      ) : null}
    </PageTitle>
  );
  if (!ws?.auditLog.length) return <div>{title}<EmptyState what="audit entries" /></div>;
  const rows = ws.auditLog.filter((a) => (actor === "all" || a.actor === actor) && (action === "all" || a.action === action));
  return (
    <div>
      {title}
      <div className="mb-2 text-[11px] text-muted">{rows.length} / {ws.auditLog.length}</div>
      <Card>
        <ol className="divide-y divide-line">
          {rows.map((a) => {
            const k = actionIcon(a.action);
            return (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-[7px] ${k.cls}`}><k.icon size={14} /></span>
                <Tip content={`${a.actor}${a.agent ? ` via ${a.agent}` : ""}`}>
                  <span aria-label={a.actor} className={`grid h-5 w-5 place-items-center rounded-full ${a.actor === "agent" ? "bg-agent/10 text-agent" : "bg-rep/10 text-rep"}`}>{a.actor === "agent" ? <Bot size={11} /> : <User size={11} />}</span>
                </Tip>
                <span className="w-[170px] shrink-0 truncate font-medium">{a.action.replace(/_/g, " ")}</span>
                <Tip content={`${a.detail || "—"}\nTarget: ${a.target}`} className="min-w-0 flex-1"><span className="truncate text-muted">{a.detail || a.target}</span></Tip>
                <span className="shrink-0 font-mono text-[10px] text-muted">{new Date(a.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
