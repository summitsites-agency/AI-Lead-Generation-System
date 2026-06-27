import type { Priority } from "@/lib/types";

export function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

/**
 * Normalize a 0–100 lead score into a priority band.
 *
 * lead_score is an opportunity score (higher = a bigger opportunity for the
 * agency), so priority runs WITH it: a high score → HIGH priority (shown green).
 *   71–100 = HIGH, 41–70 = MEDIUM, 0–40 = LOW.
 */
export function priorityFromScore(score: number): Priority {
  const s = clamp(Math.round(score), 0, 100);
  if (s >= 71) return "HIGH";
  if (s >= 41) return "MEDIUM";
  return "LOW";
}
