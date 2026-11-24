import type { Message } from "@/lib/types";
import { EMAIL_RE, SECRET_RE, extractDomains } from "./rules";

/**
 * @security: outbound checks. Links only to cited domains (or our own), no leaked emails, keys or PII,
 * and the demo-inbox redirect must be on outside production.
 */
export function securityCheck(m: Pick<Message, "id" | "subject" | "body">, ctx: { citedDomains: Set<string>; ownDomains: Set<string> }): string[] {
  const blocks: string[] = [];
  const text = `${m.subject ?? ""}\n${m.body}`;
  for (const d of extractDomains(text)) {
    if (!ctx.citedDomains.has(d) && !ctx.ownDomains.has(d)) blocks.push(`${m.id}: link to uncited domain ${d}`);
  }
  if (EMAIL_RE.test(text)) blocks.push(`${m.id}: copy contains an email address`);
  if (SECRET_RE.test(text)) blocks.push(`${m.id}: copy looks like it contains a secret`);
  return blocks;
}

export function redirectIsOn(): boolean {
  const prodWithRealRecipients = process.env.VERCEL_ENV === "production" && process.env.CITED_ALLOW_REAL_RECIPIENTS === "true";
  return !prodWithRealRecipients;
}
