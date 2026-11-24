"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, Loader2, Hand, Ban, X, MessageSquareText, Target, Search, Users, Mail, ShieldCheck, ScanSearch, Send, KanbanSquare, RotateCcw, Filter, Minus, Maximize2 } from "lucide-react";
import { useWorkspace } from "../WorkspaceProvider";
import { useRun, type StepKey, type RunState } from "./RunProvider";
import type { Workspace } from "@/lib/types";

type Status = "waiting" | "running" | "done" | "needs_you" | "blocked";
interface Node { key: StepKey; label: string; role: string; icon: typeof Check; href: string }

const NODES: Node[] = [
  { key: "intake", label: "Intake", role: "planner", icon: MessageSquareText, href: "/intake" },
  { key: "icp", label: "ICP", role: "planner → you", icon: Target, href: "/intake" },
  { key: "discovery", label: "Discovery", role: "builder", icon: Search, href: "/discovery" },
  { key: "enrich", label: "Enrich", role: "builder", icon: Users, href: "/discovery" },
  { key: "draft", label: "Draft", role: "builder", icon: Mail, href: "/outreach" },
  { key: "claim", label: "Claim check", role: "reviewer", icon: ScanSearch, href: "/outreach" },
  { key: "security", label: "Security", role: "security", icon: ShieldCheck, href: "/outreach" },
  { key: "approval", label: "Your approval", role: "you", icon: Hand, href: "/outreach" },
  { key: "send", label: "Send", role: "system", icon: Send, href: "/outreach" },
  { key: "pipeline", label: "Pipeline", role: "system", icon: KanbanSquare, href: "/pipeline" },
];
const ORDER = NODES.map((n) => n.key);

/** Status and one-line detail for each step, from what the workspace holds plus the live run. */
export function deriveSteps(ws: Workspace, run: RunState | null) {
  const s: Record<StepKey, { status: Status; detail: string }> = Object.fromEntries(ORDER.map((k) => [k, { status: "waiting" as Status, detail: "" }])) as never;
  const cos = ws.companies.filter((c) => !c.excluded);
  const filtered = ws.companies.length - cos.length;
  const claims = ws.messages.flatMap((m) => m.review?.grounding?.claims ?? []);
  const ok = claims.filter((c) => c.supported).length;
  const pending = ws.messages.filter((m) => m.status === "pending_approval" || m.status === "needs_fix").length;
  const sent = ws.messages.filter((m) => m.status === "sent").length;
  const moved = ws.leads.filter((l) => l.stage !== "matched").length;
  if (ws.product) s.intake = { status: "done", detail: ws.product.name };
  if (ws.icp) s.icp = ws.icp.approvedAt ? { status: "done", detail: `v${ws.icp.version} approved` } : { status: "needs_you", detail: "Approve the ICP" };
  if (ws.companies.length) s.discovery = { status: "done", detail: `${cos.length} cited${filtered ? ` · ${filtered} filtered` : ""}` };
  if (ws.leads.length) s.enrich = { status: "done", detail: `${ws.people.length} buyers found` };
  if (ws.messages.length) {
    s.draft = { status: "done", detail: `${ws.messages.length} touches` };
    s.claim = { status: "done", detail: claims.length ? `${ok}/${claims.length} claims cited` : "checked" };
  }
  if (ws.approvals.some((a) => a.kind === "outreach")) s.security = { status: "done", detail: "links ok" };
  if (pending) s.approval = { status: "needs_you", detail: `${pending} to review` };
  else if (sent) s.approval = { status: "done", detail: "approved" };
  if (sent) s.send = { status: "done", detail: `${sent} sent` };
  if (moved) s.pipeline = { status: "done", detail: `${moved} moved on` };

  // While the server is drafting, read the new agent events so reviewer and security light up per lead.
  const fresh = run ? ws.agentEvents.slice(run.startEvent) : [];
  const rewrites = fresh.filter((e) => e.kind === "fix").length;
  if (run?.active) {
    const a = run.active;
    s[a] = { status: "running", detail: liveDetail(a, ws, fresh) };
    if (a === "draft") {
      const checked = fresh.filter((e) => e.kind === "retrieval" && /claim check/.test(e.text)).length;
      s.draft = { status: "running", detail: `${checked} leads drafted` };
      s.claim = checked ? { status: "running", detail: `checking${rewrites ? ` · ${rewrites} rewrite${rewrites > 1 ? "s" : ""}` : ""}` } : { status: "waiting", detail: "" };
      s.security = fresh.some((e) => e.toRole === "security") ? { status: "done", detail: "links ok" } : { status: "waiting", detail: "" };
      s.approval = { status: "waiting", detail: "" };
    }
    for (const k of ORDER.slice(ORDER.indexOf(a) + 1)) if (a !== "draft" || !["claim", "security", "approval"].includes(k)) s[k] = { status: "waiting", detail: s[k].status === "done" ? "will redo" : "" };
  }
  if (run?.blocked) s[run.blocked.step] = { status: run.blocked.needsYou ? "needs_you" : "blocked", detail: run.blocked.message };
  return { steps: s, rewrites, filtered };
}

function liveDetail(step: StepKey, ws: Workspace, fresh: Workspace["agentEvents"]) {
  if (step === "discovery") return fresh.some((e) => /Moss/.test(e.text)) ? "scoring with Moss" : "searching the web";
  if (step === "enrich") return `${ws.people.length} buyers so far`;
  return "working";
}

const BADGE: Record<Status, { cls: string; label: string; icon: typeof Check | null }> = {
  waiting: { cls: "", label: "", icon: null },
  running: { cls: "bg-accent/10 text-accent border-accent/30", label: "Running", icon: Loader2 },
  done: { cls: "bg-tier-a/10 text-tier-a border-tier-a/30", label: "Completed", icon: Check },
  needs_you: { cls: "bg-tier-b/10 text-tier-b border-tier-b/30", label: "Needs you", icon: Hand },
  blocked: { cls: "bg-danger/10 text-danger border-danger/30", label: "Blocked", icon: Ban },
};
const BORDER: Record<Status, string> = {
  waiting: "border-line opacity-70",
  running: "border-accent shadow-[0_0_0_4px_rgba(124,58,237,0.12)] run-shimmer",
  done: "border-rep/60",
  needs_you: "border-tier-b run-attn",
  blocked: "border-danger",
};

// Snake layout in a 1000 × 250 box: row one left to right, row two right to left.
const W = 1000, NODE_W = 176, GAP = (W - 5 * NODE_W) / 5, ROW_Y = [26, 150], NODE_H = 78;
const pos = (i: number) => {
  const row = i < 5 ? 0 : 1, col = row === 0 ? i : 9 - i;
  return { x: GAP / 2 + col * (NODE_W + GAP), y: ROW_Y[row], row, col };
};

function edgePath(i: number) {
  const a = pos(i), b = pos(i + 1);
  if (a.row !== b.row) return `M${a.x + NODE_W / 2} ${a.y + NODE_H} V${b.y}`;
  return a.row === 0 ? `M${a.x + NODE_W} ${a.y + NODE_H / 2} H${b.x}` : `M${a.x} ${a.y + NODE_H / 2} H${b.x + NODE_W}`;
}

export function RunCanvas() {
  const { ws } = useWorkspace();
  const { run, visible, dismiss } = useRun();
  const [min, setMin] = useState(false);
  if (!visible || !ws || !run) return null;
  const { steps, rewrites, filtered } = deriveSteps(ws, run);
  const doneN = ORDER.filter((k) => steps[k].status === "done").length;
  const current = run.active ?? run.blocked?.step ?? null;
  const title = run.kind === "loop" ? "Running the loop" : run.kind === "refresh" ? "Refreshing signals" : `Running ${run.kind}`;

  const stepText = current ? `Step ${ORDER.indexOf(current) + 1} of ${ORDER.length} · ${NODES[ORDER.indexOf(current)].label}` : "Done";
  const dot = `h-2 w-2 shrink-0 rounded-full ${run.active ? "animate-pulse bg-accent" : run.blocked ? (run.blocked.needsYou ? "bg-tier-b" : "bg-danger") : "bg-tier-a"}`;

  if (min) return (
    <div role="region" aria-label="Agent run" className="run-in fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border border-line bg-white/95 py-1.5 pr-1.5 pl-3.5 shadow-xl backdrop-blur">
      <button onClick={() => setMin(false)} aria-label="Expand run view" className="flex items-center gap-2.5 text-[12.5px]">
        <span className={dot} />
        <span className="font-semibold">{title}</span>
        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(doneN / ORDER.length) * 100}%` }} /></span>
        <span className="text-muted">{stepText}</span>
        <Maximize2 size={13} className="text-muted" />
      </button>
      <button onClick={dismiss} aria-label="Close run view" className="rounded-full p-1 text-muted hover:bg-line/60 hover:text-ink"><X size={14} /></button>
    </div>
  );

  return (
    <div role="region" aria-label="Agent run" className="run-in fixed inset-x-3 bottom-3 z-40 mx-auto max-w-[1060px] rounded-[14px] border border-line bg-white/95 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <span className={dot} />
        <span className="text-[13px] font-semibold">{title}</span>
        <div className="h-1.5 max-w-[260px] flex-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${(doneN / ORDER.length) * 100}%` }} /></div>
        <span className="text-[12px] text-muted">{stepText}</span>
        {run.blocked && <span className={`truncate text-[12px] ${run.blocked.needsYou ? "text-tier-b" : "text-danger"}`}>{run.blocked.message}</span>}
        <button onClick={() => setMin(true)} aria-label="Minimise run view" className="ml-auto rounded-[6px] p-1 text-muted hover:bg-line/60 hover:text-ink"><Minus size={15} /></button>
        <button onClick={dismiss} aria-label="Close run view" className=" rounded-[6px] p-1 text-muted hover:bg-line/60 hover:text-ink"><X size={15} /></button>
      </div>
      <div className="relative h-[250px] w-full bg-[radial-gradient(rgba(0,0,0,0.07)_1px,transparent_1px)] [background-size:16px_16px]">
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${W} 250`} preserveAspectRatio="none" aria-hidden>
          {ORDER.slice(0, -1).map((k, i) => {
            const from = steps[k].status, to = steps[ORDER[i + 1]].status;
            const lit = from === "done" && (to === "done" || to === "needs_you");
            const flowing = from === "done" && to === "running";
            const d = edgePath(i);
            return (
              <g key={k}>
                <path d={d} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={flowing ? 2.5 : 2} stroke={flowing ? "#7C3AED" : lit ? "#0284C7" : "#D4D4D8"} strokeDasharray={flowing ? "6 6" : undefined} className={flowing ? "run-flow" : undefined} />
                {flowing && <circle r="4" fill="#7C3AED"><animateMotion dur="1.2s" repeatCount="indefinite" path={d} /></circle>}
              </g>
            );
          })}
        </svg>
        {NODES.map((n, i) => {
          const p = pos(i), st = steps[n.key], b = BADGE[st.status];
          return (
            <Link key={n.key} href={n.href} data-step={n.key} data-status={st.status}
              className={`absolute rounded-[10px] border-[1.5px] bg-white px-2.5 py-2 transition-all duration-500 hover:shadow-md ${BORDER[st.status]}`}
              style={{ left: `${(p.x / W) * 100}%`, top: p.y, width: `${(NODE_W / W) * 100}%`, height: NODE_H }}>
              <span className="absolute -top-2.5 left-2 rounded-[5px] bg-ink px-1.5 text-[9.5px] leading-4 text-white">{n.role}</span>
              {b.icon && <span className={`absolute -top-2.5 right-2 flex items-center gap-1 rounded-[5px] border px-1.5 text-[10px] leading-4 font-medium ${b.cls}`}><b.icon size={10} className={st.status === "running" ? "animate-spin" : ""} />{b.label}</span>}
              <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold"><n.icon size={14} className="shrink-0 text-muted" /><span className="truncate">{n.label}</span></div>
              <div className="mt-1 truncate text-[11px] text-muted" title={st.detail}>{st.detail || " "}</div>
              <div className="mt-0.5 flex gap-1">
                {n.key === "discovery" && filtered > 0 && <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-danger/10 px-1 text-[9.5px] text-danger"><Filter size={9} />{filtered} filtered</span>}
                {n.key === "claim" && rewrites > 0 && <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-danger/10 px-1 text-[9.5px] text-danger"><RotateCcw size={9} className="run-loop" />{rewrites} rewrite{rewrites > 1 ? "s" : ""}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
