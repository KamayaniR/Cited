import { NextResponse } from "next/server";
import { z } from "zod";
import { topUp } from "@/lib/pipeline/billing";
import { route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
const Body = z.object({ amount: z.number().int().min(10).max(5000) });

/** POST /api/billing/topup { amount } → { balance }. Adds credits locally and to the Flexprice wallet. */
export const POST = route(async (req: Request) => {
  const { amount } = Body.parse(await req.json());
  return NextResponse.json(await topUp(amount, "rep"));
});
