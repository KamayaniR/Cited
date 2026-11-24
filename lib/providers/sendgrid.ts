import "server-only";
import { vendorFetch } from "@/lib/monitor";
import { env, isLive } from "@/lib/env";
import { ApiError } from "@/lib/api/errors";

export interface SendResult { deliveredTo: "sendgrid" | "demo"; to: string; simulated: boolean }

/**
 * Send one approved email. Safety rules (spec Section 4):
 * - outside prod every email goes to DEMO_RECIPIENT, never the prospect
 * - SENDING_ENABLED=false is a kill switch: nothing leaves, the send is simulated
 * Callers must only pass messages a rep approved (enforced in lib/pipeline/outreach.ts).
 */
export async function sendEmail(msg: { to: string; subject: string; body: string }): Promise<SendResult> {
  const isProd = process.env.VERCEL_ENV === "production" && process.env.CITED_ALLOW_REAL_RECIPIENTS === "true";
  const to = isProd ? msg.to : env.demoRecipient ?? "demo-inbox@cited.local";

  if (!isLive("sendgrid") || !env.sendingEnabled || !env.demoRecipient) {
    return { deliveredTo: "demo", to, simulated: true };
  }
  const res = await vendorFetch("sendgrid", "https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.sendgridKey}` },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env.sendgridFrom },
      subject: isProd ? msg.subject : `[Cited demo → ${msg.to}] ${msg.subject}`,
      content: [{ type: "text/plain", value: msg.body }],
    }),
  });
  if (!res.ok) throw new ApiError("VENDOR_ERROR", `SendGrid failed: HTTP ${res.status}`, { vendor: "sendgrid" });
  return { deliveredTo: isProd ? "sendgrid" : "demo", to, simulated: false };
}
