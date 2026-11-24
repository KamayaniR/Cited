import "server-only";
import fs from "fs";
import path from "path";
import type { Workspace, AuditEntry, AgentEvent, Actor, AgentRole } from "@/lib/types";
import { newId, nowIso } from "@/lib/ids";

/**
 * Workspace store.
 * Mock mode (default): in-memory, persisted to .data/workspace.json so dev reloads keep state.
 * Live mode: the Supabase adapter (lib/db/supabase.ts) replaces this once keys are set (see README).
 */
const DATA_FILE = path.join(process.cwd(), ".data", "workspace.json");
export const STARTING_CREDITS = 100;

export function emptyWorkspace(): Workspace {
  return {
    org: { id: "org_demo", name: "Demo workspace", creditsBalance: STARTING_CREDITS },
    product: null, icp: null, expansions: [], companies: [], citations: [], signals: [], people: [],
    competitors: [], leads: [], leadEvents: [], messages: [], auditLog: [], usageEvents: [], agentEvents: [], approvals: [],
  };
}

const g = globalThis as unknown as { __citedWs?: Workspace };

function load(): Workspace {
  if (g.__citedWs) return g.__citedWs;
  try {
    g.__citedWs = { ...emptyWorkspace(), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
  } catch {
    g.__citedWs = emptyWorkspace();
  }
  return g.__citedWs!;
}

function persist(ws: Workspace) {
  if (process.env.VERCEL) return; // read-only FS on Vercel: memory only
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(ws));
  } catch { /* non-fatal in mock mode */ }
}

export function getWorkspace(): Workspace {
  return load();
}

/** Apply a change and persist. Keep mutations synchronous so they are atomic in one process. */
export function mutate<T>(fn: (ws: Workspace) => T): T {
  const ws = load();
  const out = fn(ws);
  persist(ws);
  return out;
}

export function replaceWorkspace(next: Workspace) {
  g.__citedWs = next;
  persist(next);
}

export function audit(ws: Workspace, e: { actor: Actor; agent?: string | null; action: string; target: string; detail?: string }): AuditEntry {
  const entry: AuditEntry = { id: newId("aud"), actor: e.actor, agent: e.agent ?? null, action: e.action, target: e.target, detail: e.detail ?? "", at: nowIso() };
  ws.auditLog.unshift(entry);
  return entry;
}

export function agentEvent(ws: Workspace, e: { from: AgentRole; to?: AgentRole | null; kind: string; text: string; tokens?: number; costUsd?: number }): AgentEvent {
  const ev: AgentEvent = { id: newId("aev"), fromRole: e.from, toRole: e.to ?? null, kind: e.kind, text: e.text, tokens: e.tokens ?? 0, costUsd: e.costUsd ?? 0, at: nowIso() };
  ws.agentEvents.push(ev);
  return ev;
}
