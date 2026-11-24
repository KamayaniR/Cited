import { NextResponse } from "next/server";
import { getWorkspace, mutate, audit, agentEvent } from "@/lib/db/store";
import { runDiscovery, MAX_QUERIES } from "@/lib/pipeline/discovery";
import { ApiError, route } from "@/lib/api/errors";
import { formatHandoff } from "@/lib/providers/band";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/discover: search → extract → cite-check → negative filter → score → save. Replaces previous discovery results. */
export const POST = route(async () => {
  const ws0 = getWorkspace();
  if (!ws0.product || !ws0.icp) throw new ApiError("NOT_FOUND", "Submit intake first.");
  if (!ws0.icp.approvedAt) throw new ApiError("INVALID_STATE", "Approve the ICP before discovery.");

  mutate((ws) => agentEvent(ws, { from: "planner", to: "builder", kind: "handoff", text: formatHandoff({ to: "builder", verb: "TASK", args: { icp: `v${ws0.icp!.version}`, max_queries: String(MAX_QUERIES), budget_credits: "0" }, rest: "discover" }) }));

  const out = await runDiscovery({ icp: ws0.icp.data, expansions: ws0.expansions, product: ws0.product });

  mutate((ws) => {
    // Leads/people from an earlier run point at old companies; discovery starts the funnel over.
    ws.companies = out.companies;
    ws.signals = out.signals;
    ws.citations = [...ws.citations.filter((c) => c.entityType === "expansion"), ...out.citations];
    ws.competitors = out.competitors;
    ws.people = []; ws.leads = []; ws.leadEvents = []; ws.messages = [];
    const filtered = out.companies.filter((c) => c.excluded);
    agentEvent(ws, { from: "builder", to: "planner", kind: "result", text: `Discovery: ${out.queries.length} queries, ${out.companies.length} companies cited, ${out.dropped.length} dropped (uncited), ${filtered.length} filtered, ${out.competitors.length} competitors`, tokens: out.tokens, costUsd: out.costUsd });
    for (const c of filtered) audit(ws, { actor: "agent", agent: "builder", action: "company_filtered", target: c.id, detail: `${c.name}: ${c.excludeReason}` });
    for (const d of out.dropped) audit(ws, { actor: "agent", agent: "builder", action: "uncited_dropped", target: d.name, detail: d.reason });
    audit(ws, { actor: "agent", agent: "builder", action: "discovery_run", target: ws.icp!.id, detail: `${out.companies.length} companies, ${out.signals.length} signals` });
  });

  return NextResponse.json({
    companies: out.companies.filter((c) => !c.excluded),
    filtered: out.companies.filter((c) => c.excluded),
    competitors: out.competitors,
    dropped: out.dropped,
    queries: out.queries,
    mode: out.mode,
  });
});
