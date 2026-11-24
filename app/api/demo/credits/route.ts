import { NextResponse } from "next/server";
import { z } from "zod";
import { mutate, audit } from "@/lib/db/store";
import { ApiError, route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
const Body = z.object({ balance: z.number().min(0).max(100) });

/** POST /api/demo/credits: set the demo workspace's balance (for showing the 402 gate). Demo workspace only. */
export const POST = route(async (req: Request) => {
  const { balance } = Body.parse(await req.json());
  return NextResponse.json(mutate((ws) => {
    if (ws.org.flexpriceWalletId) throw new ApiError("INVALID_STATE", "Not available once a Flexprice wallet is linked");
    ws.org.creditsBalance = balance;
    audit(ws, { actor: "rep", agent: "ui", action: "demo_balance_set", target: ws.org.id, detail: `Balance set to ${balance} for the demo` });
    return { balance };
  }));
});
