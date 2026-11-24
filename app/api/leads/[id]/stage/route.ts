import { NextResponse } from "next/server";
import { z } from "zod";
import { mutate, audit } from "@/lib/db/store";
import { moveStage } from "@/lib/pipeline/review";
import { StageEnum } from "@/lib/types";
import { ApiError, route } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const Body = z.object({ stage: StageEnum, outcome: z.enum(["won", "lost"]).optional(), note: z.string().max(500).optional() });

/** PATCH /api/leads/:id/stage: a rep moves a card. Closed/Lost requires an outcome (won or lost). */
export const PATCH = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  if (body.stage === "closed_lost" && !body.outcome) throw new ApiError("VALIDATION_ERROR", "Closed/Lost needs an outcome: won or lost");
  const lead = mutate((ws) => {
    const l = ws.leads.find((x) => x.id === id);
    if (!l) throw new ApiError("NOT_FOUND", `Lead ${id} not found`);
    if (l.stage === body.stage && body.stage !== "closed_lost") return l;
    const from = l.stage;
    moveStage(ws, l, body.stage, "rep", body.note ?? (body.outcome ? `Closed ${body.outcome}` : "Moved by rep"));
    l.outcome = body.stage === "closed_lost" ? body.outcome! : null;
    l.closeReason = body.stage === "closed_lost" ? (body.note?.trim() || null) : null;
    const company = ws.companies.find((c) => c.id === l.companyId);
    audit(ws, { actor: "rep", agent: "ui", action: "stage_changed", target: l.id, detail: `${company?.name ?? ""}: ${from} → ${body.stage}${body.outcome ? ` (${body.outcome}${body.note ? `: ${body.note}` : ""})` : ""}` });
    return l;
  });
  return NextResponse.json({ lead });
});
