import "server-only";
import { AUDIT_TO_FUNNEL, track } from "@/lib/monitor";
import fs from "fs";
import path from "path";
import type { Workspace, AuditEntry, AgentEvent, Actor, AgentRole } from "@/lib/types";
import { newId, nowIso } from "@/lib/ids";
import { mirrorEvent } from "@/lib/providers/band";

/**
 * Workspace store.
 * Mock mode (default): in-memory, persisted to .data/workspace.json so dev reloads keep state.
 * Live mode: the Supabase adapter (lib/db/supabase.ts) replaces this once keys are set (see README).
 */
// Demo data and real data never share a file: demo mode (CITED_FORCE_MOCK) has its own workspace.
const DEMO_MODE = process.env.CITED_FORCE_MOCK === "true";
const DATA_FILE = path.join(process.cwd(), ".data", DEMO_MODE ? "demo-workspace.json" : "workspace.json");

/** Demo companies all live on .example domains; real search never returns those. */
export const isDemoData = (ws: Pick<Workspace, "companies">) => ws.companies.some((c) => c.domain.endsWith(".example"));
export const STARTING_CREDITS = 100;

export function emptyWorkspace(): Workspace {
  return {
    org: { id: DEMO_MODE ? "org_demo" : "org_live", name: DEMO_MODE ? "Demo workspace" : "My workspace", creditsBalance: STARTING_CREDITS },
    product: null, icp: null, expansions: [], companies: [], citations: [], signals: [], people: [],
    competitors: [], team: [], leads: [], leadEvents: [], messages: [], auditLog: [], usageEvents: [], agentEvents: [], approvals: [],
  };
}

const g = globalThis as unknown as { __citedWs?: Workspace };

function load(): Workspace {
  if (g.__citedWs) return g.__citedWs;
  try {
    const saved = { ...emptyWorkspace(), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) } as Workspace;
    if (!DEMO_MODE && !process.env.VITEST && isDemoData(saved)) {
      // An older version kept demo data in the live file. Set it aside so the live app starts clean.
      fs.renameSync(DATA_FILE, DATA_FILE.replace(/\.json$/, ".demo-backup.json"));
      g.__citedWs = emptyWorkspace();
    } else g.__citedWs = saved;
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
  const funnel = AUDIT_TO_FUNNEL[e.action];
  if (funnel) track(funnel, ws.org.id, { actor: e.actor, target: e.target });
  return entry;
}

export function agentEvent(ws: Workspace, e: { from: AgentRole; to?: AgentRole | null; kind: string; text: string; tokens?: number; costUsd?: number }): AgentEvent {
  const ev: AgentEvent = { id: newId("aev"), fromRole: e.from, toRole: e.to ?? null, kind: e.kind, text: e.text, tokens: e.tokens ?? 0, costUsd: e.costUsd ?? 0, at: nowIso() };
  ws.agentEvents.push(ev);
  void mirrorEvent(ev); // Band room mirror; a no-op in local mode, never throws
  return ev;
}
