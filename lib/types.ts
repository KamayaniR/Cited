import { z } from "zod";

// ---- Shared enums (match supabase/migrations/0001_init.sql) ----
export const SourceEnum = z.enum(["tavily", "hunter", "apollo", "website", "mock"]);
export type Source = z.infer<typeof SourceEnum>;

export const StageEnum = z.enum(["matched", "contacted", "replied", "meeting_booked", "closed_lost"]);
export type Stage = z.infer<typeof StageEnum>;
export const STAGE_LABELS: Record<Stage, string> = {
  matched: "Matched",
  contacted: "Contacted",
  replied: "Replied",
  meeting_booked: "Meeting Booked",
  closed_lost: "Closed/Lost",
};
export const STAGES = StageEnum.options;

export const TierEnum = z.enum(["A", "B", "C"]);
export type Tier = z.infer<typeof TierEnum>;
export const ActorEnum = z.enum(["agent", "rep"]);
export type Actor = z.infer<typeof ActorEnum>;
export const EmailStatusEnum = z.enum(["valid", "accept_all", "invalid", "unknown"]);
export const ChannelEnum = z.enum(["email", "linkedin"]);
export const MessageStatusEnum = z.enum(["draft", "needs_fix", "pending_approval", "approved", "rejected", "sent"]);
export const SignalTypeEnum = z.enum(["hiring", "funding", "launch", "leadership_change", "tech_adoption", "expansion", "negative"]);
export const AgentRoleEnum = z.enum(["planner", "builder", "reviewer", "security", "human", "system"]);
export type AgentRole = z.infer<typeof AgentRoleEnum>;

// ---- Intake / ICP ----
export const ProductInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(10),
  customers: z.string().optional().default(""),
  pricing: z.string().optional().default(""),
  constraints: z.string().optional().default(""),
  teamBackground: z.string().optional().default(""),
  regions: z.array(z.string()).default([]),
  excludeRegions: z.array(z.string()).default([]),
});
export type ProductInput = z.infer<typeof ProductInputSchema>;

const Scored = <T extends z.ZodTypeAny>(v: T) => z.object({ value: v, confidence: z.number().min(0).max(1) });

export const IcpSchema = z.object({
  industries: z.array(z.object({ name: z.string(), naics: z.string(), confidence: z.number().min(0).max(1) })),
  companySize: Scored(z.object({ minEmployees: z.number(), maxEmployees: z.number() })),
  regions: Scored(z.array(z.string())),
  personas: z.array(z.object({ title: z.string(), seniority: z.string(), confidence: z.number().min(0).max(1) })),
  triggers: z.array(z.object({ signal: z.string(), confidence: z.number().min(0).max(1) })),
  negativeSignals: z.array(z.string()),
});
export type Icp = z.infer<typeof IcpSchema>;

export const ExpansionSchema = z.object({
  id: z.string(),
  segment: z.string(),
  rationale: z.string(),
  evidence: z.array(z.object({ url: z.string().url(), title: z.string() })),
  status: z.enum(["proposed", "accepted", "adjusted", "dismissed"]),
});
export type Expansion = z.infer<typeof ExpansionSchema>;

// ---- Records ----
export interface Citation { id: string; entityType: "company" | "signal" | "competitor" | "expansion"; entityId: string; url: string; title: string; snippet: string; fetchedAt: string }
export interface Signal { id: string; companyId: string; type: z.infer<typeof SignalTypeEnum>; summary: string; sourceUrl: string; detectedAt: string }
export interface Company {
  id: string; name: string; domain: string; domainSource: Source; industry: string; naics: string;
  headcount: number; region: string; hq: string | null; hqSource: Source | null;
  fitScore: number; intentScore: number; score: number; tier: Tier;
  excluded: boolean; excludeReason: string | null; signalsRefreshedAt: string;
}
export interface Person {
  id: string; companyId: string; name: string; title: string; seniority: string;
  email: string | null; emailStatus: z.infer<typeof EmailStatusEnum>; emailSource: Source | null; mx: boolean;
  linkedinUrl: string | null; linkedinSource: Source | null; personaMatch: number;
}
export interface Competitor { id: string; name: string; domain: string; category: "direct" | "adjacent" | "status_quo"; positioning: string; pricing: string; ourAdvantage: string; sourceUrl: string }
export interface Lead { id: string; companyId: string; personId: string; stage: Stage; outcome: "won" | "lost" | null; owner: Actor; variant: "A" | "B" }
export interface LeadEvent { id: string; leadId: string; fromStage: Stage | null; toStage: Stage; actor: Actor; note: string; at: string }
export interface Message {
  id: string; leadId: string; personId: string; channel: z.infer<typeof ChannelEnum>; step: 1 | 2 | 3; dayOffset: number;
  variant: "A" | "B"; valueProp: string; subject: string | null; body: string; signalIds: string[];
  status: z.infer<typeof MessageStatusEnum>; review: { reviewer?: string; security?: string; notes?: string[] } | null;
  editedByRep: boolean; sentAt: string | null; deliveredTo: "sendgrid" | "demo" | "manual:linkedin" | null;
}
export interface AuditEntry { id: string; actor: Actor; agent: string | null; action: string; target: string; detail: string; at: string }
export interface UsageEvent { id: string; eventName: "lead_enriched" | "outreach_sent" | "graph_query" | "signal_refresh"; quantity: number; credits: number; leadId: string | null; flexpriceSynced: boolean; at: string }
export interface AgentEvent { id: string; fromRole: AgentRole; toRole: AgentRole | null; kind: string; text: string; tokens: number; costUsd: number; at: string }
export interface Approval { id: string; kind: "outreach" | "schema" | "icp"; requestedBy: AgentRole; payload: Record<string, unknown>; status: "pending" | "approved" | "rejected"; decidedBy: string | null; decidedVia: "band" | "ui" | null; note: string | null; at: string }

/** The whole single-org workspace. Mock mode keeps this in memory (persisted to .data/). */
export interface Workspace {
  org: { id: string; name: string; creditsBalance: number };
  product: (ProductInput & { id: string }) | null;
  icp: { id: string; version: number; data: Icp; approvedAt: string | null } | null;
  expansions: Expansion[];
  companies: Company[];
  citations: Citation[];
  signals: Signal[];
  people: Person[];
  competitors: Competitor[];
  leads: Lead[];
  leadEvents: LeadEvent[];
  messages: Message[];
  auditLog: AuditEntry[];
  usageEvents: UsageEvent[];
  agentEvents: AgentEvent[];
  approvals: Approval[];
}
