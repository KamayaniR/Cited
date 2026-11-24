import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { pollBand } from "@/lib/pipeline/bandDecisions";
import { verifyBandWebhook } from "@/lib/providers/band";
import { ApiError, route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/webhooks/band: Band's wake-up ping when someone @mentions one of our agents. */
export const POST = route(async (req: Request) => {
  const body = await req.text();
  if (!env.bandWakeupSecret || !verifyBandWebhook(env.bandWakeupSecret, req.headers, body)) throw new ApiError("UNAUTHORIZED", "Bad Band webhook signature");
  return NextResponse.json(await pollBand());
});
