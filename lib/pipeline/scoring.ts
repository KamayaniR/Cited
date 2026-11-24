import type { Tier } from "@/lib/types";

/** Fit + Intent (each 0–100) → combined score and tier. Weights and thresholds documented in docs/system-design.md. */
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

const clamp = (n: number) => Math.max(0, Math.min(100, n));
