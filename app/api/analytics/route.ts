import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspace } from "@/lib/db/store";
import { funnel } from "@/lib/pipeline/analytics";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
const Q = z.object({ groupBy: z.enum(["industry", "tier", "variant"]).optional() });

/** GET /api/analytics?groupBy=industry|tier|variant: funnel counts and conversion rates. */
export const GET = route(async (req: Request) => {
  const { groupBy } = Q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const ws = getWorkspace();
  return NextResponse.json({ total: funnel(ws)[0] ?? null, rows: groupBy ? funnel(ws, groupBy) : [] });
});
