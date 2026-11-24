"use client";
import { useState } from "react";
import { useWorkspace } from "./WorkspaceProvider";

const ROLE_COLOR: Record<string, string> = {
  planner: "text-accent", builder: "text-agent", reviewer: "text-tier-b", security: "text-danger", human: "text-rep", system: "text-muted",
};

/** Agent Thinking panel: the agent_events stream (SSE arrives in P6; P0 reads the snapshot). */
export function AgentPanel() {
  const { ws } = useWorkspace();
  const [open, setOpen] = useState(true);
  const events = ws?.agentEvents ?? [];

  if (!open) {
    return (
      <aside className="hidden w-10 shrink-0 border-l border-line xl:block">
        <button onClick={() => setOpen(true)} className="w-full py-6 text-[11px] text-muted [writing-mode:vertical-rl]">Agent Thinking</button>
      </aside>
    );
  }
  return (
    <aside className="hidden w-[360px] shrink-0 border-l border-line xl:block">
      <div className="sticky top-12 flex max-h-[calc(100vh-3rem)] flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-accent">Agent Thinking</div>
          <button onClick={() => setOpen(false)} className="text-[12px] text-muted hover:text-ink">Collapse</button>
        </div>
        <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {events.length === 0 && <li className="text-[13px] text-muted">Idle. Agent handoffs appear here as the pipeline runs.</li>}
          {events.map((e) => (
            <li key={e.id} className="text-[12px]">
              <div className="flex items-center gap-1.5">
                <span className={`font-semibold ${ROLE_COLOR[e.fromRole]}`}>@{e.fromRole}</span>
                {e.toRole && <span className="text-muted">→ @{e.toRole}</span>}
                <span className="ml-auto font-mono text-[10px] text-muted">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="mt-0.5 font-mono text-[11px] leading-relaxed break-words">{e.text}</div>
            </li>
          ))}
        </ol>
      </div>
    </aside>
  );
}
