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

/** Website builders that strongly imply the owner built the site themselves. */
const DIY_BUILDERS = new Set(["wix", "squarespace", "godaddy", "weebly"]);

export function isDiyBuilder(builder: string | null | undefined): boolean {
  return !!builder && DIY_BUILDERS.has(builder.toLowerCase());
}

/**
 * Business-value score 0–100: how much demand/reputation a business has, i.e.
 * how worthwhile it is to win. Driven by review volume (log-scaled) and rating,
 * with a small boost for DIY-builder sites. When review data is absent (the free
 * discovery path), returns a neutral baseline so ranking degrades to weakness-only.
 */
export function valueScore(
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
  builder: string | null | undefined
): number {
  const boost = isDiyBuilder(builder) ? 10 : 0;
  if (reviewCount === null || reviewCount === undefined) {
    return clamp(50 + boost, 0, 100);
  }
  const reviews = Math.min(70, Math.round(Math.log10(reviewCount + 1) * 23));
  const rep = rating !== null && rating !== undefined ? Math.round((rating / 5) * 20) : 10;
  return clamp(reviews + rep + boost, 0, 100);
}

/**
 * Combined sort key: opportunity (website weakness) scaled by business value.
 * Higher = call this lead first. The list query computes the same product in SQL;
 * this function exists for clarity and tests.
 */
export function rankScore(leadScore: number, value: number): number {
  return leadScore * value;
}
