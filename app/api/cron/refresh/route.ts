import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ApiError, route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** GET /api/cron/refresh: Vercel Cron, every 6 hours. Signal refresh and re-scoring land in P4. */
export const GET = route(async (req: Request) => {
  if (!env.cronSecret || req.headers.get("authorization") !== `Bearer ${env.cronSecret}`) {
    throw new ApiError("UNAUTHORIZED", "Missing or wrong CRON_SECRET");
  }
  return NextResponse.json({ processed: 0, added: 0, tierChanges: 0, skippedForCredits: 0, note: "refresh implemented in P4" });
});
