"use client";
import { useState } from "react";
import { Brain, ChevronRight, PanelRightClose, PanelRightOpen, Compass, Hammer, Eye, Shield, User, Cog } from "lucide-react";
import { useWorkspace } from "./WorkspaceProvider";
import { Tip } from "./Tip";
import type { AgentEvent } from "@/lib/types";

export const ROLES: Record<string, { icon: typeof Brain; cls: string; label: string }> = {
  planner: { icon: Compass, cls: "bg-accent/12 text-accent", label: "planner" },
  builder: { icon: Hammer, cls: "bg-agent/12 text-agent", label: "builder" },
  reviewer: { icon: Eye, cls: "bg-tier-b/12 text-tier-b", label: "reviewer" },
  security: { icon: Shield, cls: "bg-danger/10 text-danger", label: "security" },
  human: { icon: User, cls: "bg-rep/12 text-rep", label: "you" },
  system: { icon: Cog, cls: "bg-line text-muted", label: "system" },
};
const VERB_TONE: Record<string, string> = { TASK: "bg-accent/10 text-accent", READY: "bg-tier-a/10 text-tier-a", APPROVAL: "bg-tier-b/15 text-tier-b", APPROVED: "bg-tier-a/10 text-tier-a", FIX: "bg-danger/10 text-danger", REPLAN: "bg-agent/10 text-agent", REJECTED: "bg-danger/10 text-danger", BLOCK: "bg-danger/10 text-danger" };

export function RoleChip({ role }: { role: string }) {
  const r = ROLES[role] ?? ROLES.system;
  return <Tip content={`@${role}`}><span className={`grid h-6 w-6 place-items-center rounded-full ${r.cls}`}><r.icon size={12} /></span></Tip>;
}

/** Turn "@builder TASK discover  icp=v1  max_queries=6" into verb, subject and arg chips. */
function parse(e: AgentEvent) {
  const t = e.text.replace(/^@\w+\s+/, "");
  const m = t.match(/^([A-Z]{3,})\b\s*(.*)$/);
  if (!m) return { verb: null as string | null, subject: t, args: [] as string[] };
  const parts = m[2].split(/\s{2,}|\s(?=\w+=)/).filter(Boolean);
  const args = parts.filter((p) => /^\w+=/.test(p));
  const subject = parts.filter((p) => !/^\w+=/.test(p)).join(" ");
  return { verb: m[1], subject, args };
}

/** Agent Thinking: who handed what to whom, as a compact stream. Full text on hover. */
export function AgentPanel() {
  const { ws } = useWorkspace();
  const [open, setOpen] = useState(true);
  const events = ws?.agentEvents ?? [];

  if (!open) {
    return (
      <aside className="hidden w-11 shrink-0 border-l border-line xl:block">
        <button onClick={() => setOpen(true)} aria-label="Open Agent Thinking" className="flex w-full flex-col items-center gap-2 py-5 text-muted hover:text-ink"><PanelRightOpen size={16} /><Brain size={16} />{events.length > 0 && <span className="text-[10px]">{events.length}</span>}</button>
      </aside>
    );
  }
  return (
    <aside className="hidden w-[320px] shrink-0 border-l border-line xl:block" aria-label="Agent Thinking">
      <div className="sticky top-12 flex max-h-[calc(100vh-3rem)] flex-col">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Brain size={15} className="text-accent" />
          <div className="text-[12px] font-semibold tracking-wider text-accent uppercase">Agent Thinking</div>
          <span className="flex -space-x-1">{["planner", "builder", "reviewer", "security"].map((r) => <RoleChip key={r} role={r} />)}</span>
          <button onClick={() => setOpen(false)} aria-label="Collapse" className="ml-auto text-muted hover:text-ink"><PanelRightClose size={15} /></button>
        </div>
        <ol className="flex-1 overflow-y-auto px-3 py-2">
          {events.length === 0 && <li className="flex items-center gap-2 px-1 py-4 text-[12px] text-muted"><Brain size={14} />Idle</li>}
          {events.map((e) => {
            const p = parse(e);
            return (
              <li key={e.id} className="group border-b border-line/60 py-2 last:border-0">
                <Tip content={e.text} className="block">
                  <div className="flex items-center gap-1.5">
                    <RoleChip role={e.fromRole} />
                    {e.toRole && <><ChevronRight size={12} className="text-muted" /><RoleChip role={e.toRole} /></>}
                    {p.verb && <span className={`rounded-[4px] px-1.5 py-0.5 font-mono text-[10px] font-semibold ${VERB_TONE[p.verb] ?? "bg-line/70 text-ink"}`}>{p.verb}</span>}
                    <span className="ml-auto font-mono text-[10px] text-muted">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 pl-[30px] text-[12px] leading-snug">{p.subject || e.text}</div>
                  {p.args.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 pl-[30px]">
                      {p.args.slice(0, 4).map((a) => <span key={a} className="rounded-[4px] bg-paper px-1 font-mono text-[10px] text-muted">{a.replace(/_/g, " ")}</span>)}
                    </div>
                  )}
                </Tip>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
