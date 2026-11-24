import { NextResponse } from "next/server";
import { mirrorGraph } from "@/lib/graph/run";
import { z } from "zod";
import { getWorkspace, mutate, audit, agentEvent } from "@/lib/db/store";
import { enrichCompany, enrichQueue, applyEnrichment, ENRICH_CREDITS } from "@/lib/pipeline/enrich";
import { requireCredits, charge } from "@/lib/pipeline/credits";
import { ApiError, route } from "@/lib/api/errors";
import { formatHandoff } from "@/lib/providers/band";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({ companyIds: z.array(z.string()).optional(), limit: z.number().int().positive().max(50).optional() }).default({});

/** POST /api/enrich: Hunter → Apollo fallback per field; 2 credits per enriched lead, checked before each. */
export const POST = route(async (req: Request) => {
  const body = Body.parse(await req.json().catch(() => ({})));
  const ws0 = getWorkspace();
  if (!ws0.icp) throw new ApiError("NOT_FOUND", "Run intake and discovery first.");
  const queue = enrichQueue(ws0, body.companyIds).slice(0, body.limit ?? 25);

  mutate((ws) => agentEvent(ws, { from: "planner", to: "builder", kind: "handoff", text: formatHandoff({ to: "builder", verb: "TASK", args: { leads: String(queue.length), budget_credits: String(queue.length * ENRICH_CREDITS) }, rest: "enrich" }) }));

  let enriched = 0, noBuyer = 0;
  const sources = { hunter: 0, apollo: 0, tavily: 0 };
  for (const company of queue) {
    try {
      requireCredits(getWorkspace(), "lead_enriched", 1, { enriched, gated: true });
    } catch (e) {
      mutate((ws) => {
        audit(ws, { actor: "agent", agent: "builder", action: "enrich_gated", target: company.id, detail: (e as Error).message });
        agentEvent(ws, { from: "builder", to: "planner", kind: "blocked", text: `CREDIT_LIMIT after ${enriched} leads: ${(e as Error).message}` });
      });
      throw e;
    }
    const r = await enrichCompany(getWorkspace().icp!.data, company);
    sources.hunter += r.calls.hunter; sources.apollo += r.calls.apollo;
    mutate((ws) => {
      const lead = applyEnrichment(ws, company, r);
      if (lead) { enriched++; charge(ws, "lead_enriched", lead.id); }
      else { noBuyer++; audit(ws, { actor: "agent", agent: "builder", action: "no_buyer_found", target: company.id, detail: company.name }); }
    });
  }

  mutate((ws) => agentEvent(ws, { from: "builder", to: "planner", kind: "result", text: `Enriched ${enriched} leads (${noBuyer} without a matching buyer). Calls: hunter ${sources.hunter}, apollo ${sources.apollo}` }));
  const graph = await mirrorGraph(getWorkspace());
  return NextResponse.json({ graph, enriched, noBuyer, gated: false, sources });
});
