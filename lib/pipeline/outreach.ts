import "server-only";
import { z } from "zod";
import { completeJson } from "@/lib/providers/llm";
import { reviewMessage } from "@/lib/agents/reviewer";
import { securityCheck } from "@/lib/agents/security";
import { hostOf } from "./citations";
import type { Workspace, Lead, Message, Signal, ProductInput, Company, Person } from "@/lib/types";
import { newId } from "@/lib/ids";
import { BUZZWORDS, wordLimit } from "@/lib/agents/rules";

/** Sequence shape: touch 1 email (day 0), touch 2 LinkedIn (day 2, sent by hand), touch 3 email (day 5). */
export const SEQUENCE = [
  { step: 1 as const, channel: "email" as const, dayOffset: 0 },
  { step: 2 as const, channel: "linkedin" as const, dayOffset: 2 },
  { step: 3 as const, channel: "email" as const, dayOffset: 5 },
];
export const VALUE_PROPS = { A: "Saves time: faster outcome with less manual work", B: "Reduces risk: fewer errors and a clean audit trail" } as const;
export const MAX_FIX_ROUNDS = 2;

const DraftSchema = z.object({
  messages: z.array(z.object({
    step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    channel: z.enum(["email", "linkedin"]),
    subject: z.string().nullable(),
    body: z.string(),
    signalIds: z.array(z.string()),
  })).length(3),
});
type Draft = z.infer<typeof DraftSchema>["messages"][number];

interface Ctx { product: ProductInput; company: Company; person: Person; signals: Signal[]; variant: "A" | "B"; sender: string }

const firstSentence = (s: string) => (s.split(/(?<=\.)\s/)[0] ?? s).replace(/\.$/, "");
const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
/** Short phrase from a signal summary: up to the first clause break, cut at a word boundary. */
export function shortSignal(summary: string, max = 45): string {
  const clause = lcFirst(summary).split(/,|\(|\.|\s+and\s+|\s+to\s+/)[0].trim();
  if (clause.length <= max) return clause;
  return clause.slice(0, max).replace(/\s+\S*$/, "");
}

function mockDraft(c: Ctx): Draft[] {
  const first = c.person.name.split(" ")[0];
  const sig = c.signals.find((s) => s.type !== "negative");
  const sigLine = sig ? `I saw the news from ${c.company.name}: ${lcFirst(sig.summary)}.` : `I came across ${c.company.name} while looking at ${c.company.industry.toLowerCase()} teams.`;
  const value = c.variant === "A"
    ? `${c.product.name} ${lcFirst(firstSentence(c.product.description).replace(new RegExp(`^${c.product.name}\\s+`), ""))}.`
    : `${c.product.name} keeps every step reviewable, so there are fewer errors and a clean audit trail.`;
  return [
    { step: 1, channel: "email", subject: sig ? `${c.company.name}: ${shortSignal(sig.summary)}` : `${c.company.name} and ${c.product.name}`,
      body: `Hi ${first},\n\n${sigLine} Teams at that stage often feel the strain on ${c.person.title.toLowerCase().includes("financ") || /cfo|controller/i.test(c.person.title) ? "finance operations" : "operations"}.\n\n${value}\n\nWorth a 20 minute look next week?\n\n${c.sender}`,
      signalIds: sig ? [sig.id] : [] },
    { step: 2, channel: "linkedin", subject: null,
      body: `Hi ${first}, I sent you a short note about ${c.company.name}${sig ? ` and ${shortSignal(sig.summary, 60)}` : ""}. Happy to connect and share what similar teams have learned.`,
      signalIds: sig ? [sig.id] : [] },
    { step: 3, channel: "email", subject: `Re: ${c.company.name}`,
      body: `Hi ${first},\n\nOne last note from me. ${c.variant === "A" ? "Most teams we work with get days back every month." : "Most teams we work with cut review rework by half."} If this isn't a priority this quarter, no problem at all.\n\nOpen to a short call?\n\n${c.sender}`,
      signalIds: [] },
  ];
}

/** Mock "builder fix": applies the reviewer's mechanical fixes so the loop is visible in mock mode. */
function mockFix(d: Draft, fixes: string[], limit: number): Draft {
  let body = d.body.replace(/\s*[—–]\s*/g, ", ");
  for (const b of BUZZWORDS) body = body.replace(new RegExp(`\\b${b}\\b`, "gi"), "");
  if (fixes.some((f) => f.includes("words"))) body = body.split(/\s+/).slice(0, limit).join(" ");
  return { ...d, body, subject: d.subject?.replace(/[—–]/g, ",") ?? null };
}

async function draft(c: Ctx, fixes: string[] = [], previous?: Draft[]) {
  const limit = wordLimit(c.person.seniority);
  return completeJson({
    task: fixes.length ? "outreach_fix" : "outreach_draft",
    system: `You write B2B outreach for a founder. Plain, specific, human.
Rules:
- 3 messages: step 1 email (day 0), step 2 LinkedIn connection note (day 2, max 60 words, no subject), step 3 email (day 5).
- Step 1 must reference exactly one of the provided signals and put its id in signalIds. Never invent facts beyond the signals and product.
- Email bodies max ${limit} words. One call to action (one question) per message.
- No em dashes or en dashes. No buzzwords (${BUZZWORDS.slice(0, 8).join(", ")}...). No links.
- Angle (variant ${c.variant}): ${VALUE_PROPS[c.variant]}.
- Sign as ${c.sender}.`,
    prompt: `Product: ${JSON.stringify(c.product)}\nCompany: ${c.company.name} (${c.company.industry}, ${c.company.headcount} employees)\nRecipient: ${c.person.name}, ${c.person.title}\nSignals: ${JSON.stringify(c.signals.filter((s) => s.type !== "negative").map((s) => ({ id: s.id, type: s.type, summary: s.summary })))}\n${fixes.length ? `\nPrevious draft:\n${JSON.stringify(previous)}\nFix these reviewer findings:\n- ${fixes.join("\n- ")}\n` : ""}\nReturn {"messages":[{"step":1,"channel":"email","subject":"","body":"","signalIds":[]}, ...]}`,
    schema: DraftSchema,
    mock: () => ({ messages: fixes.length && previous ? previous.map((d) => mockFix(d, fixes.filter((f) => f.startsWith(`s${d.step}:`)), d.channel === "linkedin" ? 60 : limit)) : mockDraft(c) }),
  });
}

export interface SequenceResult { messages: Message[]; rounds: number; fixes: string[][]; blocks: string[]; tokens: number; costUsd: number }

/** Builder drafts → Reviewer (fix loop, max 2) → Security. Messages end pending_approval, or needs_fix when escalated/blocked. */
export async function buildSequence(ws: Workspace, lead: Lead): Promise<SequenceResult> {
  const company = ws.companies.find((c) => c.id === lead.companyId)!;
  const person = ws.people.find((p) => p.id === lead.personId)!;
  const signals = ws.signals.filter((s) => s.companyId === company.id);
  const sender = (ws.product?.teamBackground.match(/^(?:co-?founder\s+)?([A-Z][a-z]+)/i)?.[1]) ?? `The ${ws.product!.name} team`;
  const ctx: Ctx = { product: ws.product!, company, person, signals, variant: lead.variant, sender: /^(co|the)$/i.test(sender) ? `The ${ws.product!.name} team` : sender };
  const signalIds = new Set(signals.map((s) => s.id));

  let tokens = 0, costUsd = 0;
  let res = await draft(ctx);
  tokens += res.tokens; costUsd += res.costUsd;
  let drafts = res.data.messages;
  const review = (ds: Draft[]) => ds.flatMap((d) => reviewMessage({ id: `s${d.step}`, ...d }, { seniority: person.seniority, signalIds }));
  let fixes = review(drafts);
  const fixLog: string[][] = [fixes];
  let rounds = 0;
  while (fixes.length && rounds < MAX_FIX_ROUNDS) {
    rounds++;
    res = await draft(ctx, fixes, drafts);
    tokens += res.tokens; costUsd += res.costUsd;
    drafts = res.data.messages;
    fixes = review(drafts);
    fixLog.push(fixes);
  }

  const citedDomains = new Set(ws.citations.map((c) => hostOf(c.url)));
  const blocks = drafts.flatMap((d) => securityCheck({ id: `s${d.step}`, ...d }, { citedDomains, ownDomains: new Set() }));

  const messages: Message[] = drafts.map((d) => {
    const seq = SEQUENCE.find((s) => s.step === d.step)!;
    const mine = (arr: string[]) => arr.filter((f) => f.startsWith(`s${d.step}:`)).map((f) => f.slice(f.indexOf(":") + 2));
    const myFixes = mine(fixes), myBlocks = mine(blocks);
    return {
      id: newId("msg"), leadId: lead.id, personId: person.id, channel: seq.channel, step: d.step, dayOffset: seq.dayOffset,
      variant: lead.variant, valueProp: VALUE_PROPS[lead.variant], subject: seq.channel === "email" ? d.subject : null, body: d.body,
      signalIds: d.signalIds.filter((id) => signalIds.has(id)),
      status: myFixes.length || myBlocks.length ? "needs_fix" : "pending_approval",
      review: { reviewer: myFixes.length ? "fail" : "pass", security: myBlocks.length ? "block" : "pass", notes: [...myFixes, ...myBlocks] },
      editedByRep: false, sentAt: null, deliveredTo: null,
    };
  });
  // Unknown email keeps the lead out of email touches; no LinkedIn URL means no LinkedIn touch.
  const reachable = messages.filter((m) => (m.channel === "email" ? Boolean(person.email) : Boolean(person.linkedinUrl)));
  return { messages: reachable, rounds, fixes: fixLog, blocks, tokens, costUsd };
}

/** Leads ready for drafting: Matched, no messages yet, and a reachable channel. */
export function draftQueue(ws: Workspace, leadIds?: string[]): Lead[] {
  const has = new Set(ws.messages.map((m) => m.leadId));
  return ws.leads.filter((l) => l.stage === "matched" && !has.has(l.id) && (!leadIds || leadIds.includes(l.id)));
}
