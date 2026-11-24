import { NextResponse } from "next/server";
import { mutate, audit } from "@/lib/db/store";
import { moveStage } from "@/lib/pipeline/review";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/sendgrid: SendGrid Inbound Parse (multipart form) or a JSON test payload { from }.
 * A reply from a lead's email moves the lead to Replied. Protect with ?token=CRON_SECRET in the webhook URL.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  if (process.env.CRON_SECRET && url.searchParams.get("token") !== process.env.CRON_SECRET) return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "bad token", details: {} } }, { status: 401 });

  let from = "";
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) from = String((await req.json()).from ?? "");
  else { const f = await req.formData(); from = String(f.get("from") ?? ""); }
  const email = (from.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0] ?? "").toLowerCase();

  const matched = mutate((ws) => {
    const person = ws.people.find((p) => p.email?.toLowerCase() === email);
    const lead = person && ws.leads.find((l) => l.personId === person.id);
    if (!lead || lead.stage !== "contacted") return null;
    moveStage(ws, lead, "replied", "agent", "Reply received (SendGrid inbound parse)");
    audit(ws, { actor: "agent", agent: "webhook", action: "reply_received", target: lead.id, detail: "" });
    return lead.id;
  });
  return NextResponse.json({ ok: true, lead: matched });
}
