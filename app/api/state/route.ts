import { NextResponse } from "next/server";
import { getWorkspace } from "@/lib/db/store";
import { vendorModes } from "@/lib/env";
import { bandMode } from "@/lib/providers/band";
import { graphEngine } from "@/lib/graph/neo4j";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** GET /api/state: full workspace snapshot plus data modes for the top bar. */
export const GET = route(async () => {
  return NextResponse.json({
    workspace: getWorkspace(),
    modes: { vendors: vendorModes(), band: bandMode(), graph: graphEngine() },
  });
});
