// Central env access. Server-only: never import from client components.
import "server-only";

export const env = {
  llmProvider: process.env.LLM_PROVIDER ?? "anthropic",
  llamaKey: process.env.LLAMA_API_KEY,
  llamaModel: process.env.LLAMA_MODEL ?? "Llama-4-Maverick-17B-128E-Instruct-FP8",
  llamaBaseUrl: process.env.LLAMA_BASE_URL ?? "https://api.llama.com/compat/v1",
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
  tavilyKey: process.env.TAVILY_API_KEY,
  hunterKey: process.env.HUNTER_API_KEY,
  apolloKey: process.env.APOLLO_API_KEY,
  sendgridKey: process.env.SENDGRID_API_KEY,
  sendgridFrom: process.env.SENDGRID_FROM,
  get flexpriceKey() { return process.env.FLEXPRICE_API_KEY; },
  flexpriceBaseUrl: process.env.FLEXPRICE_BASE_URL ?? "https://api.cloud.flexprice.io/v1",
  get bandKey() { return process.env.BAND_API_KEY; },
  get bandRoomId() { return process.env.BAND_ROOM_ID; },
  get bandApiUrl() { return process.env.BAND_API_URL ?? "https://app.band.ai/api/v1"; },
  /** Optional: one Band agent key per role, so each role speaks as itself. BAND_API_KEY is used for any role without one. */
  bandRoleKey(role: string): string | undefined { return process.env[`BAND_${role.toUpperCase()}_KEY`] ?? process.env.BAND_API_KEY; },
  get bandWakeupSecret() { return process.env.BAND_WAKEUP_SECRET; },
  mossProjectId: process.env.MOSS_PROJECT_ID,
  mossProjectKey: process.env.MOSS_PROJECT_KEY,
  mossIndex: process.env.MOSS_INDEX ?? "cited-evidence",
  neo4jUri: process.env.NEO4J_URI,
  neo4jUser: process.env.NEO4J_USER ?? "neo4j",
  neo4jPassword: process.env.NEO4J_PASSWORD,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  get cronSecret() { return process.env.CRON_SECRET; },
  demoRecipient: process.env.DEMO_RECIPIENT,
  sendingEnabled: process.env.SENDING_ENABLED === "true",
  forceMock: process.env.CITED_FORCE_MOCK === "true",
  /** Tests (and anyone who sets CITED_ALLOW_MOCK) may fall back to mocks when a key is missing. The live app never does. */
  get allowMock() { return process.env.CITED_ALLOW_MOCK === "true" || Boolean(process.env.VITEST); },
};

/** Vendors that produce data the user sees. In live mode a missing key is an error, never made-up results. */
export const DATA_VENDORS: Vendor[] = ["llm", "tavily", "hunter", "apollo"];

const KEY_NAMES: Partial<Record<Vendor, string>> = { llm: "LLAMA_API_KEY", tavily: "TAVILY_API_KEY", hunter: "HUNTER_API_KEY", apollo: "APOLLO_API_KEY" };

export class MissingKeyError extends Error {
  constructor(public vendor: Vendor) { super(`${KEY_NAMES[vendor] ?? vendor} is not set. Add it to .env.local to run this step on real data.`); }
}

/**
 * Should this call use the mock? Demo mode (CITED_FORCE_MOCK) always does. In the live app a data vendor
 * without its key throws MissingKeyError, so nothing invented ever reaches the screen.
 */
export function mockFor(v: Vendor): boolean {
  if (env.forceMock) return true;
  if (isLive(v)) return false;
  if (DATA_VENDORS.includes(v) && !env.allowMock) throw new MissingKeyError(v);
  return true;
}

/** Demo mode = the deterministic demo-data workspace (E2E tests, recording the demo video). */
export function isDemoMode(): boolean { return env.forceMock; }

export type Vendor =
  | "llm" | "tavily" | "hunter" | "apollo" | "sendgrid"
  | "flexprice" | "band" | "neo4j" | "supabase" | "moss";

/** True when the vendor has the keys it needs and mock mode is not forced. */
export function isLive(v: Vendor): boolean {
  if (env.forceMock) return false;
  switch (v) {
    case "llm": return Boolean(env.llamaKey) || Boolean(env.anthropicKey) || Boolean(env.mossProjectId && env.mossProjectKey);
    case "tavily": return Boolean(env.tavilyKey);
    case "hunter": return Boolean(env.hunterKey);
    case "apollo": return Boolean(env.apolloKey);
    case "sendgrid": return Boolean(env.sendgridKey && env.sendgridFrom);
    case "flexprice": return Boolean(env.flexpriceKey);
    case "band": return Boolean(env.bandKey && env.bandRoomId);
    case "neo4j": return Boolean(env.neo4jUri && env.neo4jPassword);
    case "supabase": return Boolean(env.supabaseUrl && env.supabaseServiceKey);
    case "moss": return Boolean(env.mossProjectId && env.mossProjectKey);
  }
}

export const VENDORS: Vendor[] = ["llm", "tavily", "hunter", "apollo", "sendgrid", "flexprice", "band", "neo4j", "supabase", "moss"];

export function vendorModes(): Record<Vendor, "live" | "mock"> {
  return Object.fromEntries(VENDORS.map((v) => [v, isLive(v) ? "live" : "mock"])) as Record<Vendor, "live" | "mock">;
}
