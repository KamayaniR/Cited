import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspace } from "@/lib/db/store";
import { refreshSignals } from "@/lib/pipeline/refresh";
import { ApiError, route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const Body = z.object({ companyIds: z.array(z.string()).max(50).optional() });

/** POST /api/signals/refresh: the "Run refresh now" button. Same code path as the 6-hourly cron. */
export const POST = route(async (req: Request) => {
  const body = Body.parse(await req.json().catch(() => ({})));
  if (!getWorkspace().icp) throw new ApiError("INVALID_STATE", "Run intake and discovery first.");
  const r = await refreshSignals({ companyIds: body.companyIds, actor: "rep", trigger: "manual" });
  return NextResponse.json(r);
});
