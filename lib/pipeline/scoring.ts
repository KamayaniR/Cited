import type { Icp, Tier, Signal } from "@/lib/types";

/**
 * Fit + Intent scoring (0–100 each) → combined score and tier.
 * Fit: how well the firmographics match the approved ICP.
 * Intent: how many fresh buying signals the company shows.
 */
export const FIT_WEIGHT = 0.6;
export const INTENT_WEIGHT = 0.4;
export const TIER_A_MIN = 75;
export const TIER_B_MIN = 55;

export function combineScore(fit: number, intent: number): number {
  return Math.round(FIT_WEIGHT * clamp(fit) + INTENT_WEIGHT * clamp(intent));
}

export function tierFor(score: number): Tier {
  return score >= TIER_A_MIN ? "A" : score >= TIER_B_MIN ? "B" : "C";
}

/** Fit = 45 industry + 30 size + 25 region. Industry credit scales with the ICP field's confidence. */
export function fitScore(icp: Icp, c: { naics: string; industry: string; headcount: number; region: string }): number {
  const exact = icp.industries.find((i) => i.naics === c.naics);
  const sector = icp.industries.find((i) => i.naics.slice(0, 3) === c.naics.slice(0, 3));
  const industry = exact ? 45 * (0.5 + exact.confidence / 2) : sector ? 25 * (0.5 + sector.confidence / 2) : 0;

  const { minEmployees, maxEmployees } = icp.companySize.value;
  const size = c.headcount >= minEmployees && c.headcount <= maxEmployees ? 30
    : c.headcount >= minEmployees * 0.5 && c.headcount <= maxEmployees * 1.5 ? 15 : 0;

  const region = icp.regions.value.some((r) => r.toLowerCase() === c.region.toLowerCase()) ? 25 : 0;
  return Math.round(industry + size + region);
}

const SIGNAL_POINTS: Record<Signal["type"], number> = {
  hiring: 30, tech_adoption: 30, leadership_change: 25, funding: 25, expansion: 25, launch: 15, negative: 0,
};

/** Intent = signal points (each signal type counted once), +10 if a signal matches an ICP trigger, decayed by age. */
export function intentScore(icp: Icp, signals: Pick<Signal, "type" | "summary" | "detectedAt">[], now = new Date()): number {
  const seen = new Set<string>();
  let total = 0;
  for (const s of signals) {
    if (s.type === "negative" || seen.has(s.type)) continue;
    seen.add(s.type);
    const ageDays = (now.getTime() - new Date(s.detectedAt).getTime()) / 86_400_000;
    const decay = ageDays <= 30 ? 1 : ageDays <= 90 ? 0.7 : 0.4;
    const triggerMatch = icp.triggers.some((t) => overlap(t.signal, s.summary) >= 2) ? 10 : 0;
    total += (SIGNAL_POINTS[s.type] + triggerMatch) * decay;
  }
  return Math.round(clamp(total));
}

function overlap(a: string, b: string): number {
  const words = (s: string) => new Set(s.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
  const wb = words(b);
  return [...words(a)].filter((w) => wb.has(w)).length;
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));
