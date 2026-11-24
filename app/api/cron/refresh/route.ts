import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ApiError, route } from "@/lib/api/errors";
import { refreshSignals } from "@/lib/pipeline/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/cron/refresh: Vercel Cron, every 6 hours (vercel.json). Re-pulls signals for Tier A/B
 * companies, re-indexes Moss, re-scores and re-tiers. Out of credits → skipped and counted, never 402.
 */
export const GET = route(async (req: Request) => {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    throw new ApiError("UNAUTHORIZED", "Missing or wrong CRON_SECRET");
  }
  const r = await refreshSignals({ actor: "agent", trigger: "cron" });
  return NextResponse.json({ processed: r.processed, added: r.added, tierChanges: r.tierChanges, skippedForCredits: r.skippedForCredits, filtered: r.filtered });
});
