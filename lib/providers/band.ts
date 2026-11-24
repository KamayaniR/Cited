import "server-only";
import { vendorFetch } from "@/lib/monitor";
import crypto from "crypto";
import { env, isLive } from "@/lib/env";
import type { AgentEvent, AgentRole } from "@/lib/types";

/**
 * Band multi-agent room (band.ai). The four roles (planner, builder, reviewer, security) hand work
 * to each other with fixed-shape @mention lines. Every agent_event Cited writes is mirrored into the
 * Band room: a handoff to another agent becomes a real @mention message, anything else becomes a
 * room event, and approval requests become blocking "attention" events plus an @mention of the
 * human. Humans decide by replying in the room ("approve b_1", "reject msg_x too long"); Cited
 * polls those replies and runs the same decision code as its own queue (lib/pipeline/decide.ts).
 *
 * Without BAND_API_KEY + BAND_ROOM_ID the same roles run in-process and write the same agent_events
 * ("Band: offline (local agents)").
 *
 * Handoff lines follow spec Section 5, e.g. "@builder TASK discover  icp=v3  max_queries=6  budget_credits=0"
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

// ---------- Human decisions typed in the room ----------

export type BandCommand =
  | { kind: "approve_batch"; target: string; except: Record<string, string> }
  | { kind: "reject_batch"; target: string; reason: string }
  | { kind: "reject_message"; id: string; reason: string }
  | { kind: "edit_subject"; id: string; subject: string }
  | { kind: "schema"; id: string; decision: "approve" | "reject"; reason: string }
  | { kind: "unknown"; text: string };

/** Strip Band's @[[id]] mention tokens and leading @names, then read one decision. */
export function parseCommand(raw: string): BandCommand {
  const text = raw.replace(/@\[\[[^\]]+\]\]/g, " ").replace(/(^|\s)@[\w.-]+/g, " ").replace(/\s+/g, " ").trim();
  let m = text.match(/\b(approve|reject)\s+(apr_schema_\w+)\s*(.*)$/i);
  if (m) return { kind: "schema", id: m[2], decision: m[1].toLowerCase() as "approve" | "reject", reason: m[3].trim() };
  m = text.match(/\bedit\s+(msg_\w+)\s+subject\s*[:=]\s*(.+)$/i);
  if (m) return { kind: "edit_subject", id: m[1], subject: m[2].trim() };
  m = text.match(/\breject\s+(msg_\w+)\s*(.*)$/i);
  if (m) return { kind: "reject_message", id: m[1], reason: m[2].trim() || "rejected in Band" };
  m = text.match(/\breject\s+(b_\w+|apr_\w+|all|batch)\b\s*(.*)$/i);
  if (m) return { kind: "reject_batch", target: m[1], reason: m[2].trim() || "rejected in Band" };
  m = text.match(/\bapprove\s+(b_\w+|apr_\w+|all|batch)\b(.*)$/i);
  if (m) {
    const except: Record<string, string> = {};
    for (const x of m[2].matchAll(/(msg_\w+)(?:\s*\(([^)]*)\))?/g)) except[x[1]] = x[2]?.trim() || "rejected in Band";
    return { kind: "approve_batch", target: m[1], except };
  }
  return { kind: "unknown", text };
}

// ---------- REST client ----------

interface Participant { id: string; type: "User" | "Agent"; name: string; handle?: string | null }
interface BandMessage { id: string; content: string; sender_id: string; sender_name?: string; sender_type: "User" | "Agent" }

const status = { posted: 0, failed: 0, lastError: null as string | null, lastPollAt: null as string | null };
export function bandStatus() { return { mode: bandMode(), room: env.bandRoomId ?? null, ...status }; }

async function call<T>(key: string, method: string, path: string, body?: unknown): Promise<{ status: number; data: T | null }> {
  const res = await vendorFetch("band", `${env.bandApiUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-api-key": key },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return { status: 204, data: null };
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { message?: string; code?: string } } | null;
  if (!res.ok) throw new Error(`Band ${method} ${path} → ${res.status} ${json?.error?.code ?? ""} ${json?.error?.message ?? ""}`.trim());
  return { status: res.status, data: (json?.data ?? null) as T | null };
}

const cache = { participants: null as { at: number; list: Participant[] } | null, self: new Map<string, string>() };
export function resetBandCache() { cache.participants = null; cache.self.clear(); }

async function participants(): Promise<Participant[]> {
  if (cache.participants && Date.now() - cache.participants.at < 60_000) return cache.participants.list;
  const r = await call<Participant[]>(env.bandKey!, "GET", `/agent/chats/${env.bandRoomId}/participants`);
  cache.participants = { at: Date.now(), list: r.data ?? [] };
  return cache.participants.list;
}

async function selfId(key: string): Promise<string | null> {
  if (cache.self.has(key)) return cache.self.get(key)!;
  const r = await call<{ id: string }>(key, "GET", "/agent/me");
  if (r.data?.id) cache.self.set(key, r.data.id);
  return r.data?.id ?? null;
}

/** The room participant playing a role: the human is the first User; agents are matched by name or handle. */
export function participantFor(list: Participant[], role: AgentRole): Participant | null {
  if (role === "human") return list.find((p) => p.type === "User") ?? null;
  return list.find((p) => p.type === "Agent" && `${p.name} ${p.handle ?? ""}`.toLowerCase().includes(role)) ?? null;
}

const keyFor = (role: AgentRole) => env.bandRoleKey(role === "human" ? "planner" : role)!;

/** Mirror one agent_event into the room. Never throws: Band being down must not break the pipeline. */
export async function mirrorEvent(ev: AgentEvent): Promise<"message" | "event" | "skipped" | "failed"> {
  if (!isLive("band")) return "skipped";
  try {
    const key = keyFor(ev.fromRole);
    const [list, me] = await Promise.all([participants(), selfId(key)]);
    const target = ev.toRole ? participantFor(list, ev.toRole) : null;
    const room = env.bandRoomId!;
    const label = ev.fromRole === "human" ? "[rep, via Cited]" : `[${ev.fromRole}]`;
    if (target && target.id !== me) {
      // A real handoff: the @mention routes it to that participant.
      const body = ev.text.replace(/^@\w+\s*/, "");
      await call(key, "POST", `/agent/chats/${room}/messages`, { message: { content: `@${target.name} ${label} ${body}`, mentions: [{ id: target.id, name: target.name }] } });
      if (ev.kind === "approval") {
        await call(key, "POST", `/agent/chats/${room}/events`, { event: { content: `${ev.text}\nReply "approve <batch>", "approve <batch> except msg_x (reason)", "reject msg_x <reason>" or "approve|reject apr_schema_n".`, message_type: "attention", metadata: { kind: "review", blocking: true } } });
      }
      status.posted++;
      return "message";
    }
    await call(key, "POST", `/agent/chats/${room}/events`, {
      event: { content: `${label} ${ev.text}`, message_type: ev.kind === "approval" ? "attention" : ev.kind === "result" ? "task" : "thought", metadata: ev.kind === "approval" ? { kind: "review", blocking: true } : { role: ev.fromRole, kind: ev.kind } },
    });
    status.posted++;
    return "event";
  } catch (e) {
    status.failed++; status.lastError = (e as Error).message;
    console.warn("[band]", status.lastError);
    return "failed";
  }
}

/**
 * Read humans' replies addressed to our agents (oldest first), claim each, hand it to `apply`, answer
 * in the room, and mark it processed. Messages from agents are acknowledged and ignored: only a person
 * can approve.
 */
export async function pollDecisions(apply: (cmd: BandCommand, from: string) => Promise<string>): Promise<{ handled: number; replies: string[] }> {
  if (!isLive("band")) return { handled: 0, replies: [] };
  const room = env.bandRoomId!;
  const keys = [...new Set((["security", "planner", "builder", "reviewer"] as AgentRole[]).map(keyFor))];
  const replies: string[] = [];
  let handled = 0;
  const errors: string[] = [];
  for (const key of keys) {
    try { await pollKey(key); } catch (e) { errors.push((e as Error).message); }
  }
  status.lastPollAt = new Date().toISOString();
  // Band trouble is reported, never thrown: the queue in Cited still works without it.
  if (errors.length && !handled) replies.push(`Band could not be read right now (${errors[0].slice(0, 120)}). Decide here instead.`);
  return { handled, replies };

  async function pollKey(key: string) {
    for (let i = 0; i < 20; i++) {
      let next: { status: number; data: BandMessage | null };
      try { next = await call<BandMessage>(key, "GET", `/agent/chats/${room}/messages/next`); }
      catch (e) { if (/→ 404/.test((e as Error).message)) break; throw e; }
      if (next.status === 204 || !next.data) break;
      const msg = next.data;
      const claim = await call(key, "POST", `/agent/chats/${room}/messages/${msg.id}/processing`);
      if (claim.status === 204) continue;
      try {
        if (msg.sender_type === "User") {
          const cmd = parseCommand(msg.content);
          const reply = cmd.kind === "unknown"
            ? `I didn't find a decision in that. Try "approve b_1", "reject msg_x too long", or "approve apr_schema_1".`
            : await apply(cmd, msg.sender_name ?? "rep");
          replies.push(reply);
          await call(key, "POST", `/agent/chats/${room}/messages`, { message: { content: `@${msg.sender_name ?? "rep"} ${reply}`, mentions: [{ id: msg.sender_id, name: msg.sender_name }] } }).catch(() => null);
          handled++;
        }
        await call(key, "POST", `/agent/chats/${room}/messages/${msg.id}/processed`);
      } catch (e) {
        await call(key, "POST", `/agent/chats/${room}/messages/${msg.id}/failed`, { error: (e as Error).message }).catch(() => null);
        replies.push(`Failed: ${(e as Error).message}`);
      }
    }
  }
}

/** Standard Webhooks signature (webhook-id.timestamp.body, HMAC-SHA256, base64), or a plain bearer secret. */
export function verifyBandWebhook(secret: string, headers: Headers, body: string): boolean {
  if (headers.get("authorization") === `Bearer ${secret}`) return true;
  const id = headers.get("webhook-id"), ts = headers.get("webhook-timestamp"), sig = headers.get("webhook-signature");
  if (!id || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = secret.startsWith("whsec_") ? Buffer.from(secret.slice(6), "base64") : Buffer.from(secret);
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest("base64");
  return sig.split(" ").some((s) => {
    const v = s.split(",")[1] ?? "";
    return v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected));
  });
}

