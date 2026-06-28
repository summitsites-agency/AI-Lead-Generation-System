import "server-only";
import type { DiscoveredBusiness } from "@/lib/types";
import { mapOsmResult, type NominatimResult } from "./osm";

/**
 * Look up a single business by name + city via OpenStreetMap's Nominatim —
 * pure HTTP, no browser, so it works on the hosted site. Returns candidate
 * matches (often 0–N) for the user to pick from. The city narrows an otherwise
 * very noisy name search.
 */
export async function lookupByName(
  name: string,
  city: string,
  limit = 10
): Promise<DiscoveredBusiness[]> {
  const q = `${name} ${city}`.trim();
  if (!q) return [];

  const url =
    `https://nominatim.openstreetmap.org/search?` +
    new URLSearchParams({
      q,
      format: "json",
      addressdetails: "1",
      extratags: "1",
      namedetails: "1",
      limit: String(Math.min(limit, 20)),
    }).toString();

  const res = await fetch(url, {
    headers: {
      // Nominatim usage policy requires an identifying User-Agent.
      "User-Agent": "SummitSitesLeadGen/1.0 (local tool)",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const results = (await res.json()) as NominatimResult[];
  return results.map(mapOsmResult);
}
