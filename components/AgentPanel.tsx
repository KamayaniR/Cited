"use client";
import { useState } from "react";
import { Brain, PanelRightClose, PanelRightOpen, Compass, Hammer, Eye, Shield, User, Cog } from "lucide-react";
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  const latest = events.at(-1);
  const newestFirst = [...events].reverse().slice(0, 60);
  const recent = latest && Date.now() - new Date(latest.at).getTime() < 20_000 ? latest.fromRole : null;
  return (
    <aside className="hidden w-[300px] shrink-0 border-l border-line xl:block" aria-label="Agent Thinking">
      <div className="sticky top-12 flex max-h-[calc(100vh-3rem)] flex-col">
        <div className="flex items-center gap-2 px-4 pt-4">
          <div className="font-mono text-[11px] tracking-[0.12em] text-muted">AGENTS</div>
          <button onClick={() => setOpen(false)} aria-label="Collapse" className="ml-auto text-muted hover:text-ink"><PanelRightClose size={15} /></button>
        </div>
        <div className="flex justify-between px-4 pt-3 pb-3">
          {(["planner", "builder", "reviewer", "security"] as const).map((r) => (
            <span key={r} className="flex flex-col items-center gap-1 text-[10px] text-muted">
              <span className={`grid h-9 w-9 place-items-center rounded-full border font-serif text-[14px] transition ${recent === r ? "border-accent bg-accent text-white shadow-[0_0_0_6px_rgba(106,53,224,0.2)]" : "border-accent/20 bg-accent/10 text-accent"}`}>{r[0].toUpperCase()}</span>
              {r[0].toUpperCase() + r.slice(1)}
            </span>
          ))}
        </div>
        <ol className="flex-1 space-y-1.5 overflow-y-auto border-t border-line px-3 py-3">
          {events.length === 0 && <li className="flex items-center gap-2 px-1 py-4 text-[12px] text-muted"><Brain size={14} />Idle. Run the loop to watch them work.</li>}
          {newestFirst.map((e, i) => (
            <li key={e.id} className={`rounded-[10px] border border-line bg-white px-2.5 py-1.5 ${i < 8 ? "c-rise" : ""}`} style={i < 8 ? { animationDelay: `${i * 60}ms` } : undefined}>
              <Tip content={e.text} className="block">
                <div className="flex items-start gap-2 text-[12px] leading-snug">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[e.fromRole] ?? "bg-muted"}`} />
                  <span className="line-clamp-2 flex-1">{friendly(e)}</span>
                  <span className="shrink-0 font-mono text-[9.5px] text-muted">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </Tip>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}

const DOT: Record<string, string> = { planner: "bg-accent", builder: "bg-agent", reviewer: "bg-tier-b", security: "bg-danger", human: "bg-rep", system: "bg-muted" };
const NAME = (r?: string | null) => (r === "human" ? "You" : r ? r[0].toUpperCase() + r.slice(1) : "");

/** One short human sentence per event; the raw protocol line stays in the hover tip. */
function friendly(e: AgentEvent): string {
  const p = parse(e);
  const subject = p.subject.replace(/@\w+/g, "").trim();
  switch (p.verb) {
    case "TASK": return `${NAME(e.fromRole)} asked ${NAME(e.toRole)} to ${subject || "start"}`;
    case "READY": return `${NAME(e.fromRole)} handed ${subject || "work"} to ${NAME(e.toRole)}`;
    case "APPROVAL": return `Waiting on you: ${subject || "approval"}`;
    case "APPROVED": return `You approved ${subject}`;
    case "REJECTED": return `You rejected ${subject}`;
    case "FIX": return `Reviewer sent a draft back for a fix`;
    case "BLOCK": return `Security blocked a message`;
    case "ESCALATE": return `Reviewer needs you on a draft`;
    case "REPLAN": return `Planner is re-planning`;
    default: return subject || e.text;
  }
}
