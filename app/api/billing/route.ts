import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/db/store";
import { billingSummary } from "@/lib/pipeline/billing";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** GET /api/billing: balance, plan, prices, usage by event, Flexprice wallet state. */
export const GET = route(async () => NextResponse.json(await billingSummary(getWorkspace())));
