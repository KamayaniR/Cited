import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildDemoWorkspace } from "@/lib/seed/demo";
import { replaceWorkspace, getWorkspace, mutate, audit } from "@/lib/db/store";
import { markSent } from "@/lib/pipeline/review";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { charge } from "@/lib/pipeline/credits";
import { captureError, monitorStatus, resetMonitor, vendorFetch, track } from "@/lib/monitor";
import { GET as healthGet } from "@/app/api/health/route";

process.env.VERCEL = "1";

type Call = { url: string; init?: RequestInit };
function stubFetch(status = 200) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url: String(url), init }); return new Response("{}", { status }); }));
  return calls;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => { resetMonitor(); replaceWorkspace(buildDemoWorkspace(new Date())); });
afterEach(() => { vi.unstubAllGlobals(); delete process.env.SENTRY_DSN; delete process.env.POSTHOG_KEY; vi.restoreAllMocks(); });

describe("Sentry", () => {
  it("posts an error envelope to the DSN's project with the auth header", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    process.env.SENTRY_DSN = "https://abc123@o1.ingest.sentry.io/4242";
    const calls = stubFetch();
    captureError(new Error("boom"), { route: "/api/enrich" });
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://o1.ingest.sentry.io/api/4242/envelope/");
    expect(String((calls[0].init!.headers as Record<string, string>)["x-sentry-auth"])).toContain("sentry_key=abc123");
    const [header, item, event] = String(calls[0].init!.body).split("\n").map((l) => JSON.parse(l));
    expect(header.event_id).toMatch(/^[0-9a-f]{32}$/);
    expect(item.type).toBe("event");
    expect(event.exception.values[0]).toMatchObject({ type: "Error", value: "boom" });
    expect(event.tags.route).toBe("/api/enrich");
    expect(monitorStatus().sentry_posted).toBe(1);
  });

  it("only logs without a DSN, and unhandled route errors are captured", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const calls = stubFetch();
    const res = errorResponse(new Error("db down"));
    expect(res.status).toBe(502);
    await flush();
    expect(calls).toHaveLength(0);
    expect(log).toHaveBeenCalled();
    expect(monitorStatus()).toMatchObject({ sentry: "log-only", errorsCaptured: 1 });
  });
});

describe("PostHog funnel", () => {
  it("maps audit actions and enrichment charges to funnel events", async () => {
    process.env.POSTHOG_KEY = "phc_test";
    const calls = stubFetch();
    const ws = getWorkspace();
    audit(ws, { actor: "rep", action: "intake_submitted", target: "org" });
    audit(ws, { actor: "rep", action: "icp_approved", target: "icp_1" });
    audit(ws, { actor: "rep", action: "graph_query", target: "warm" }); // not a funnel step
    charge(ws, "lead_enriched", ws.leads[0].id);
    await flush();
    const events = calls.filter((c) => c.url.endsWith("/capture/")).map((c) => JSON.parse(String(c.init!.body)));
    expect(events.map((e) => e.event)).toEqual(["intake_done", "icp_approved", "lead_enriched"]);
    expect(events[0]).toMatchObject({ api_key: "phc_test", distinct_id: ws.org.id });
    expect(monitorStatus().funnel).toEqual({ intake_done: 1, icp_approved: 1, lead_enriched: 1 });
  });

  it("keeps counts in memory without a key", () => {
    const calls = stubFetch();
    track("stage_changed", "org_x");
    expect(calls).toHaveLength(0);
    expect(monitorStatus()).toMatchObject({ posthog: "memory-only", funnel: { stage_changed: 1 } });
  });
});

describe("alerts", () => {
  it("fires when a vendor's error rate passes 10%", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubFetch(200);
    for (let i = 0; i < 9; i++) await vendorFetch("hunter", "https://api.hunter.io/x");
    expect(monitorStatus().alerts).toEqual([]);
    stubFetch(503);
    await vendorFetch("hunter", "https://api.hunter.io/x");
    expect(monitorStatus().alerts).toEqual([]); // exactly 10% is not above the threshold
    await vendorFetch("hunter", "https://api.hunter.io/x");
    expect(monitorStatus().alerts.map((a) => a.key)).toEqual(["vendor_error_rate:hunter"]);
    // 404 means "not found", not a vendor failure
    stubFetch(404);
    await vendorFetch("apollo", "https://api.apollo.io/x");
    expect(monitorStatus().vendors.apollo.errors).toBe(0);
  });

  it("fires on a spike of 402 responses", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let i = 0; i < 4; i++) errorResponse(new ApiError("CREDIT_LIMIT", "Need 2 credits"));
    expect(monitorStatus().alerts).toEqual([]);
    errorResponse(new ApiError("CREDIT_LIMIT", "Need 2 credits"));
    expect(monitorStatus().alerts.map((a) => a.key)).toEqual(["http_402_spike"]);
  });

  it("blocks and alerts on any send without approval", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const m = getWorkspace().messages.find((x) => x.status === "pending_approval")!;
    expect(() => mutate((ws) => {
      const message = ws.messages.find((x) => x.id === m.id)!;
      markSent(ws, message, ws.leads.find((l) => l.id === message.leadId)!, { deliveredTo: "demo", actor: "agent", detail: "" });
    })).toThrow(/not approved/);
    expect(getWorkspace().messages.find((x) => x.id === m.id)!.status).toBe("pending_approval");
    expect(monitorStatus().alerts.map((a) => a.key)).toEqual(["send_without_approval"]);
  });

  it("health exposes monitoring without secrets", async () => {
    process.env.SENTRY_DSN = "https://secretkey@o1.ingest.sentry.io/1";
    const body = await (await healthGet()).json();
    expect(body.monitoring).toMatchObject({ sentry: "live", alerts: [] });
    expect(JSON.stringify(body)).not.toContain("secretkey");
  });
});
