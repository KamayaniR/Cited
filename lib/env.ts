// Central env access. Server-only: never import from client components.
import "server-only";

export const env = {
  llmProvider: process.env.LLM_PROVIDER ?? "anthropic",
  anthropicKey: process.env.ANTHROPIC_API_KEY,
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
  tavilyKey: process.env.TAVILY_API_KEY,
  hunterKey: process.env.HUNTER_API_KEY,
  apolloKey: process.env.APOLLO_API_KEY,
  sendgridKey: process.env.SENDGRID_API_KEY,
  sendgridFrom: process.env.SENDGRID_FROM,
  flexpriceKey: process.env.FLEXPRICE_API_KEY,
  flexpriceBaseUrl: process.env.FLEXPRICE_BASE_URL ?? "https://api.cloud.flexprice.io/v1",
  bandKey: process.env.BAND_API_KEY,
  bandRoomId: process.env.BAND_ROOM_ID,
  neo4jUri: process.env.NEO4J_URI,
  neo4jUser: process.env.NEO4J_USER ?? "neo4j",
  neo4jPassword: process.env.NEO4J_PASSWORD,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  cronSecret: process.env.CRON_SECRET,
  demoRecipient: process.env.DEMO_RECIPIENT,
  sendingEnabled: process.env.SENDING_ENABLED === "true",
  forceMock: process.env.CITED_FORCE_MOCK === "true",
};

export type Vendor =
  | "llm" | "tavily" | "hunter" | "apollo" | "sendgrid"
  | "flexprice" | "band" | "neo4j" | "supabase";

/** True when the vendor has the keys it needs and mock mode is not forced. */
export function isLive(v: Vendor): boolean {
  if (env.forceMock) return false;
  switch (v) {
    case "llm": return Boolean(env.anthropicKey);
    case "tavily": return Boolean(env.tavilyKey);
    case "hunter": return Boolean(env.hunterKey);
    case "apollo": return Boolean(env.apolloKey);
    case "sendgrid": return Boolean(env.sendgridKey && env.sendgridFrom);
    case "flexprice": return Boolean(env.flexpriceKey);
    case "band": return Boolean(env.bandKey && env.bandRoomId);
    case "neo4j": return Boolean(env.neo4jUri && env.neo4jPassword);
    case "supabase": return Boolean(env.supabaseUrl && env.supabaseServiceKey);
  }
}

export const VENDORS: Vendor[] = ["llm", "tavily", "hunter", "apollo", "sendgrid", "flexprice", "band", "neo4j", "supabase"];

export function vendorModes(): Record<Vendor, "live" | "mock"> {
  return Object.fromEntries(VENDORS.map((v) => [v, isLive(v) ? "live" : "mock"])) as Record<Vendor, "live" | "mock">;
}
