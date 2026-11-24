import { NextResponse } from "next/server";
import { pollBand } from "@/lib/pipeline/bandDecisions";
import { bandStatus } from "@/lib/providers/band";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/band/poll: read human decisions typed in the Band room and apply them. */
export const POST = route(async () => NextResponse.json({ ...(await pollBand()), status: bandStatus() }));
/** GET /api/band/poll: Band connection status. */
export const GET = route(async () => NextResponse.json(bandStatus()));
