/**
 * Discovery scans drive a real browser (Playwright), which can't run on Vercel's
 * serverless functions. So discovery is blocked only on the hosted Vercel
 * deployment — detected at runtime via `process.env.VERCEL`, which Vercel sets
 * on every build and function. Locally (and on any non-Vercel host) it's enabled
 * by default, matching the client-side hostname check in the scraper page.
 *
 * `NEXT_PUBLIC_SCRAPER_ENABLED=true` is an optional override to force-enable
 * discovery even on Vercel.
 */
export function isDiscoveryBlocked(
  env: Record<string, string | undefined> = process.env
): boolean {
  const onVercel = !!env.VERCEL;
  const forceEnabled = env.NEXT_PUBLIC_SCRAPER_ENABLED === "true";
  return onVercel && !forceEnabled;
}
