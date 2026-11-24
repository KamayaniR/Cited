import crypto from "crypto";

/**
 * Monitoring (spec Section 9): Sentry for API errors and vendor failures, PostHog for funnel events,
 * and in-process alert counters (vendor error rate > 10%, a spike of 402s, any send without approval).
 *
 * Both vendors are optional. Without SENTRY_DSN errors go to the server log; without POSTHOG_KEY funnel
 * events are kept in memory only. Every call here is fire-and-forget and never throws: monitoring must
 * not break the pipeline. Monitoring calls use the global fetch directly so they are not counted as
 * vendor traffic themselves.
 */

const cfg = {
  get sentryDsn() { return process.env.SENTRY_DSN || null; },
  get posthogKey() { return process.env.POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY || null; },
  get posthogHost() { return (process.env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, ""); },
  get environment() { return process.env.VERCEL_ENV || process.env.NODE_ENV || "development"; },
};

export const FUNNEL_EVENTS = ["intake_done", "icp_approved", "lead_enriched", "message_approved", "stage_changed"] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

/** Audit actions that are also product funnel steps. lead_enriched comes from the credit meter. */
export const AUDIT_TO_FUNNEL: Record<string, FunnelEvent> = {
  intake_submitted: "intake_done",
  icp_approved: "icp_approved",
  message_approved: "message_approved",
  stage_changed: "stage_changed",
};

export const ALERT_RULES = { vendorErrorRate: 0.1, vendorMinCalls: 5, http402Spike: 5, http402WindowMs: 10 * 60_000 };

interface VendorStats { calls: number; errors: number; lastError: string | null }
const state = {
  vendors: {} as Record<string, VendorStats>,
  http402: [] as number[],
  sendsWithoutApproval: 0,
  errorsCaptured: 0,
  sentryPosted: 0,
  sentryFailed: 0,
  funnel: {} as Record<string, number>,
  posthogPosted: 0,
  posthogFailed: 0,
  firedAlerts: new Set<string>(),
};

export function resetMonitor() {
  state.vendors = {}; state.http402 = []; state.sendsWithoutApproval = 0; state.errorsCaptured = 0;
  state.sentryPosted = 0; state.sentryFailed = 0; state.funnel = {}; state.posthogPosted = 0; state.posthogFailed = 0;
  state.firedAlerts.clear();
}

// ---------- Sentry ----------

function parseDsn(dsn: string): { key: string; host: string; projectId: string; protocol: string } | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "");
    if (!u.username || !projectId) return null;
    return { key: u.username, host: u.host, projectId, protocol: u.protocol };
  } catch { return null; }
}

function frames(stack: string | undefined) {
  if (!stack) return undefined;
  const lines = stack.split("\n").slice(1, 30).map((l) => l.trim().replace(/^at\s+/, ""));
  // Sentry wants oldest frame first.
  return { frames: lines.reverse().map((l) => ({ function: l.split(" (")[0], filename: (l.match(/\((.*?):\d+:\d+\)/)?.[1]) ?? l })) };
}

async function postSentry(event: Record<string, unknown>) {
  const dsn = cfg.sentryDsn && parseDsn(cfg.sentryDsn);
  if (!dsn) return;
  const eventId = crypto.randomUUID().replace(/-/g, "");
  const body = [
    JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString(), dsn: cfg.sentryDsn }),
    JSON.stringify({ type: "event" }),
    JSON.stringify({ event_id: eventId, timestamp: Date.now() / 1000, platform: "node", environment: cfg.environment, server_name: "cited", ...event }),
  ].join("\n");
  try {
    const res = await fetch(`${dsn.protocol}//${dsn.host}/api/${dsn.projectId}/envelope/`, {
      method: "POST",
      headers: { "content-type": "application/x-sentry-envelope", "x-sentry-auth": `Sentry sentry_version=7, sentry_key=${dsn.key}, sentry_client=cited/0.1` },
      body,
    });
    if (res.ok) state.sentryPosted++; else state.sentryFailed++;
  } catch { state.sentryFailed++; }
}

/** Report an unexpected error (API 5xx, vendor failure). Never throws. */
export function captureError(err: unknown, context: { route?: string; vendor?: string; [k: string]: unknown } = {}) {
  state.errorsCaptured++;
  const e = err instanceof Error ? err : new Error(String(err));
  console.error("[monitor]", context.vendor ?? context.route ?? "", e.message);
  const tags: Record<string, string> = {};
  if (context.route) tags.route = String(context.route);
  if (context.vendor) tags.vendor = String(context.vendor);
  void postSentry({ level: "error", tags, extra: context, exception: { values: [{ type: e.name, value: e.message, stacktrace: frames(e.stack) }] } });
}

/** Report an alert as a Sentry message (once per alert key per process). */
function raiseAlert(key: string, message: string, extra: Record<string, unknown>) {
  if (state.firedAlerts.has(key)) return;
  state.firedAlerts.add(key);
  console.warn("[alert]", message);
  void postSentry({ level: key === "send_without_approval" ? "fatal" : "warning", message: { formatted: message }, tags: { alert: key }, extra });
}

// ---------- PostHog ----------

/** Record a product funnel event. Never throws. */
export function track(event: FunnelEvent, distinctId: string, properties: Record<string, unknown> = {}) {
  state.funnel[event] = (state.funnel[event] ?? 0) + 1;
  const key = cfg.posthogKey;
  if (!key) return;
  void fetch(`${cfg.posthogHost}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, properties: { ...properties, $lib: "cited-server", environment: cfg.environment }, timestamp: new Date().toISOString() }),
  }).then((r) => { if (r.ok) state.posthogPosted++; else state.posthogFailed++; }).catch(() => { state.posthogFailed++; });
}

// ---------- Vendor traffic and alerts ----------

/** True for responses that mean the vendor failed us (not "no result" answers like 404). */
export function isVendorFailure(status: number) {
  return status >= 500 || status === 401 || status === 403 || status === 429;
}

/** fetch() for a vendor API: counts calls and failures for the error-rate alert. Behaves exactly like fetch. */
export async function vendorFetch(vendor: string, url: string, init?: RequestInit): Promise<Response> {
  const v = (state.vendors[vendor] ??= { calls: 0, errors: 0, lastError: null });
  v.calls++;
  try {
    const res = await fetch(url, init);
    if (isVendorFailure(res.status)) recordVendorError(vendor, `HTTP ${res.status}`);
    return res;
  } catch (e) {
    recordVendorError(vendor, (e as Error).message);
    throw e;
  }
}

function recordVendorError(vendor: string, message: string) {
  const v = (state.vendors[vendor] ??= { calls: 0, errors: 0, lastError: null });
  v.errors++;
  v.lastError = message;
  captureError(new Error(`${vendor}: ${message}`), { vendor });
  checkAlerts();
}

export function record402() {
  const now = Date.now();
  state.http402 = state.http402.filter((t) => now - t < ALERT_RULES.http402WindowMs);
  state.http402.push(now);
  checkAlerts();
}

/** Called if anything tries to mark a message sent that a human did not approve. Should never happen. */
export function recordSendWithoutApproval(messageId: string, status: string) {
  state.sendsWithoutApproval++;
  checkAlerts({ messageId, status });
}

export interface Alert { key: string; message: string }

export function activeAlerts(): Alert[] {
  const out: Alert[] = [];
  for (const [vendor, v] of Object.entries(state.vendors)) {
    if (v.calls >= ALERT_RULES.vendorMinCalls && v.errors / v.calls > ALERT_RULES.vendorErrorRate) {
      out.push({ key: `vendor_error_rate:${vendor}`, message: `${vendor} error rate ${Math.round((100 * v.errors) / v.calls)}% (${v.errors}/${v.calls})` });
    }
  }
  const recent402 = state.http402.filter((t) => Date.now() - t < ALERT_RULES.http402WindowMs).length;
  if (recent402 >= ALERT_RULES.http402Spike) out.push({ key: "http_402_spike", message: `${recent402} credit-limit (402) responses in the last 10 minutes` });
  if (state.sendsWithoutApproval > 0) out.push({ key: "send_without_approval", message: `${state.sendsWithoutApproval} send attempt(s) without approval were blocked` });
  return out;
}

function checkAlerts(extra: Record<string, unknown> = {}) {
  for (const a of activeAlerts()) raiseAlert(a.key, a.message, extra);
}

/** Snapshot for /api/health. No secrets. */
export function monitorStatus() {
  return {
    sentry: cfg.sentryDsn ? "live" : "log-only",
    posthog: cfg.posthogKey ? "live" : "memory-only",
    errorsCaptured: state.errorsCaptured,
    sentry_posted: state.sentryPosted,
    sentry_failed: state.sentryFailed,
    posthog_posted: state.posthogPosted,
    posthog_failed: state.posthogFailed,
    funnel: { ...state.funnel },
    vendors: Object.fromEntries(Object.entries(state.vendors).map(([k, v]) => [k, { ...v, errorRate: v.calls ? Number((v.errors / v.calls).toFixed(3)) : 0 }])),
    http402LastWindow: state.http402.filter((t) => Date.now() - t < ALERT_RULES.http402WindowMs).length,
    sendsWithoutApproval: state.sendsWithoutApproval,
    alerts: activeAlerts(),
  };
}
