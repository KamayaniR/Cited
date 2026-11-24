import { NextResponse } from "next/server";
import { syncPendingUsage, linkWallet } from "@/lib/pipeline/billing";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** POST /api/billing/sync: link the Flexprice wallet if needed and push any unsynced usage events. */
export const POST = route(async () => {
  const link = await linkWallet().catch((e: Error) => ({ error: e.message }));
  return NextResponse.json({ link, ...(await syncPendingUsage()) });
});
