import type { Workspace, Stage, Lead } from "@/lib/types";
import { STAGES } from "@/lib/types";

export type GroupBy = "industry" | "tier" | "variant";
const OPEN: Stage[] = ["matched", "contacted", "replied", "meeting_booked"];
const RANK: Record<Stage, number> = { matched: 0, contacted: 1, replied: 2, meeting_booked: 3, closed_lost: 4 };

/**
 * Which stages a lead has reached, from its history. Open stages are cumulative (a lead a rep
 * dragged straight to Meeting Booked also counts as contacted and replied). Closed counts only if
 * the lead is closed now, so a reopened lead doesn't inflate the close numbers.
 */
export function reachedStages(ws: Workspace, lead: Lead): Set<Stage> {
  let best = lead.stage === "closed_lost" ? -1 : RANK[lead.stage];
  for (const e of ws.leadEvents) if (e.leadId === lead.id && e.toStage !== "closed_lost") best = Math.max(best, RANK[e.toStage]);
  const out = new Set<Stage>(OPEN.filter((s) => RANK[s] <= Math.max(best, 0)));
  if (lead.stage === "closed_lost") out.add("closed_lost");
  return out;
}

export interface FunnelRow {
  group: string;
  leads: number;
  reached: Record<Stage, number>;
  won: number;
  lost: number;
  contactRate: number; replyRate: number; meetingRate: number; winRate: number;
}

const rate = (a: number, b: number) => (b ? Number((a / b).toFixed(3)) : 0);

export function groupKey(ws: Workspace, l: Lead, groupBy?: GroupBy): string {
  if (!groupBy) return "All leads";
  const c = ws.companies.find((x) => x.id === l.companyId);
  if (groupBy === "industry") return c?.industry || "Unknown";
  if (groupBy === "tier") return `Tier ${c?.tier ?? "?"}`;
  return `Variant ${l.variant}`;
}

export function funnel(ws: Workspace, groupBy?: GroupBy): FunnelRow[] {
  const groups = new Map<string, Lead[]>();
  for (const l of ws.leads) { const k = groupKey(ws, l, groupBy); groups.set(k, [...(groups.get(k) ?? []), l]); }
  return [...groups.entries()].map(([group, leads]) => {
    const reached = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
    let won = 0, lost = 0;
    for (const l of leads) {
      for (const s of reachedStages(ws, l)) reached[s]++;
      if (l.stage === "closed_lost" && l.outcome === "won") won++;
      if (l.stage === "closed_lost" && l.outcome === "lost") lost++;
    }
    return {
      group, leads: leads.length, reached, won, lost,
      contactRate: rate(reached.contacted, leads.length),
      replyRate: rate(reached.replied, reached.contacted),
      meetingRate: rate(reached.meeting_booked, reached.contacted),
      winRate: rate(won, won + lost),
    };
  }).sort((a, b) => b.leads - a.leads || a.group.localeCompare(b.group));
}
