"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useWorkspace } from "../WorkspaceProvider";
import { api } from "../api";
import type { Workspace } from "@/lib/types";

/**
 * Live agent runs. Every agent action (discovery, enrich, draft, refresh, or the whole loop) goes through
 * `track`, which marks its step running, polls the workspace while the server works so the canvas can show
 * progress, and records the outcome. The canvas is visible only while a run is active.
 */
export type StepKey = "intake" | "icp" | "discovery" | "enrich" | "draft" | "claim" | "security" | "approval" | "send" | "pipeline";
export type RunKind = "loop" | "discovery" | "enrich" | "draft" | "refresh";
export interface RunState {
  kind: RunKind;
  active: StepKey | null;
  blocked: { step: StepKey; message: string; needsYou?: boolean } | null;
  startEvent: number;
  startedAt: number;
  endedAt: number | null;
}

interface Ctx {
  run: RunState | null;
  visible: boolean;
  track: <T>(kind: RunKind, step: StepKey, fn: () => Promise<T>) => Promise<T>;
  runLoop: () => Promise<void>;
  dismiss: () => void;
}

const RunCtx = createContext<Ctx | null>(null);
const POLL_MS = 1200;
const LINGER_MS = 3500;

export function RunProvider({ children }: { children: React.ReactNode }) {
  const { ws, refresh } = useWorkspace();
  const [run, setRun] = useState<RunState | null>(null);
  const [visible, setVisible] = useState(false);
  const wsRef = useRef<Workspace | null>(ws);
  useEffect(() => { wsRef.current = ws; }, [ws]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll while a step is running so the canvas fills in as the server writes agent events.
  useEffect(() => {
    if (!run?.active) return;
    const t = setInterval(() => { void refresh(); }, POLL_MS);
    return () => clearInterval(t);
  }, [run?.active, refresh]);

  const begin = useCallback((kind: RunKind) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    const r: RunState = { kind, active: null, blocked: null, startEvent: wsRef.current?.agentEvents.length ?? 0, startedAt: Date.now(), endedAt: null };
    setRun(r); setVisible(true);
    return r;
  }, []);

  const finish = useCallback((blocked: RunState["blocked"]) => {
    setRun((r) => (r ? { ...r, active: null, blocked, endedAt: Date.now() } : r));
    // Close on its own after a short look at the result. A block stays until you dismiss it.
    if (!blocked) hideTimer.current = setTimeout(() => setVisible(false), LINGER_MS);
  }, []);

  const step = useCallback(async <T,>(s: StepKey, fn: () => Promise<T>): Promise<T> => {
    setRun((r) => (r ? { ...r, active: s } : r));
    try { return await fn(); }
    finally { void refresh(); }
  }, [refresh]);

  const track = useCallback(async <T,>(kind: RunKind, s: StepKey, fn: () => Promise<T>): Promise<T> => {
    begin(kind);
    try {
      const out = await step(s, fn);
      finish(null);
      return out;
    } catch (e) {
      finish({ step: s, message: (e as Error).message });
      throw e;
    }
  }, [begin, step, finish]);

  /** Run every step that has work, in order, and stop where a human is needed. Sends always wait for you. */
  const runLoop = useCallback(async () => {
    begin("loop");
    let cur: StepKey = "intake";
    try {
      let w = await refresh();
      if (!w?.product) return finish({ step: "intake", message: "Describe your product to start.", needsYou: true });
      cur = "icp";
      if (!w.icp?.approvedAt) return finish({ step: "icp", message: "Review and approve the ICP.", needsYou: true });
      cur = "discovery";
      if (!w.companies.length) { await step("discovery", () => api("/api/discover", { method: "POST" })); w = await refresh(); }
      cur = "enrich";
      const done = new Set(w?.leads.map((l) => l.companyId));
      if (w?.companies.some((c) => !c.excluded && !done.has(c.id))) { await step("enrich", () => api("/api/enrich", { method: "POST", body: {} })); w = await refresh(); }
      cur = "draft";
      const drafted = new Set(w?.messages.map((m) => m.leadId));
      if (w?.leads.some((l) => !drafted.has(l.id))) { await step("draft", () => api("/api/outreach/generate", { method: "POST", body: {} })); w = await refresh(); }
      const pending = w?.messages.filter((m) => m.status === "pending_approval" || m.status === "needs_fix").length ?? 0;
      finish(pending ? { step: "approval", message: `${pending} messages wait for your approval.`, needsYou: true } : null);
    } catch (e) {
      finish({ step: cur, message: (e as Error).message });
    }
  }, [begin, step, finish, refresh]);

  const dismiss = useCallback(() => { if (hideTimer.current) clearTimeout(hideTimer.current); setVisible(false); }, []);

  return <RunCtx.Provider value={{ run, visible: visible && run !== null, track, runLoop, dismiss }}>{children}</RunCtx.Provider>;
}

export function useRun() {
  const c = useContext(RunCtx);
  if (!c) throw new Error("useRun outside RunProvider");
  return c;
}
