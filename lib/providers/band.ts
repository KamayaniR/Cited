import "server-only";
import { isLive } from "@/lib/env";
import type { AgentRole } from "@/lib/types";

/**
 * Band multi-agent room. P0 ships the local fallback only: the four roles run in-process and write
 * agent_events, which the Agent Thinking panel reads. P6 adds the live Band room (handoffs, approval cards).
 *
 * Handoff lines follow the fixed shape from spec Section 5, e.g.
 *   "@builder TASK discover  icp=v3  max_queries=6  budget_credits=0"
 */
export function bandMode(): "live" | "local" {
  return isLive("band") ? "live" : "local";
}

export interface Handoff { to: AgentRole; verb: string; args: Record<string, string>; rest: string }

export function formatHandoff(h: Handoff): string {
  const args = Object.entries(h.args).map(([k, v]) => `${k}=${v}`).join("  ");
  return `@${h.to} ${h.verb}${args ? "  " + args : ""}${h.rest ? "  " + h.rest : ""}`;
}

const ROLES: AgentRole[] = ["planner", "builder", "reviewer", "security", "human"];

export function parseHandoff(line: string): Handoff | null {
  const m = line.trim().match(/^@(\w+)\s+([A-Z]+)\s*(.*)$/);
  if (!m || !ROLES.includes(m[1] as AgentRole)) return null;
  const args: Record<string, string> = {};
  const rest: string[] = [];
  for (const tok of m[3].split(/\s{2,}|\s(?=\w+=)/).filter(Boolean)) {
    const kv = tok.match(/^(\w+)=(.+)$/);
    if (kv) args[kv[1]] = kv[2]; else rest.push(tok);
  }
  return { to: m[1] as AgentRole, verb: m[2], args, rest: rest.join(" ") };
}
