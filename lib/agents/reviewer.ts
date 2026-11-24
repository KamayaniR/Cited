import type { Message } from "@/lib/types";
import { BUZZWORDS, wordCount, wordLimit } from "./rules";

/**
 * @reviewer: fact and copy checks. Returns a list of fixes; empty means pass.
 * The Reviewer never edits copy itself; fixes go back to @builder.
 */
export function reviewMessage(m: Pick<Message, "id" | "step" | "channel" | "subject" | "body" | "signalIds">, ctx: { seniority: string; signalIds: Set<string> }): string[] {
  const fixes: string[] = [];
  const text = `${m.subject ?? ""}\n${m.body}`;
  if (m.step === 1) {
    if (m.signalIds.length === 0) fixes.push(`${m.id}: touch 1 cites no signal id`);
    for (const id of m.signalIds) if (!ctx.signalIds.has(id)) fixes.push(`${m.id}: cites unknown signal ${id}`);
  }
  const limit = m.channel === "linkedin" ? 60 : wordLimit(ctx.seniority);
  const words = wordCount(m.body);
  if (words > limit) fixes.push(`${m.id}: ${words} words, limit ${limit}`);
  if (/[—–]/.test(text)) fixes.push(`${m.id}: contains an em or en dash`);
  const lower = text.toLowerCase();
  const bw = BUZZWORDS.filter((b) => new RegExp(`\\b${b}\\b`).test(lower));
  if (bw.length) fixes.push(`${m.id}: buzzwords (${bw.join(", ")})`);
  const ctas = (m.body.match(/\?/g) ?? []).length;
  if (ctas > 1) fixes.push(`${m.id}: ${ctas} questions; keep one CTA`);
  if (m.channel === "email" && !m.subject) fixes.push(`${m.id}: email has no subject`);
  return fixes;
}
