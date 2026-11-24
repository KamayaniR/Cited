import { NextResponse } from "next/server";
import { vendorModes, env } from "@/lib/env";
import { monitorStatus } from "@/lib/monitor";

export const dynamic = "force-dynamic";

/** GET /api/health: which vendors are live vs mock, and whether the send kill switch is on. Also monitoring counters and active alerts. No secrets returned. */
export async function GET() {
  return NextResponse.json({ ok: true, vendors: vendorModes(), sendingEnabled: env.sendingEnabled, demoRecipientSet: Boolean(env.demoRecipient), monitoring: monitorStatus() });
}
