import "server-only";
import type { DiscoveredBusiness } from "@/lib/types";

interface NominatimResult {
  display_name?: string;
  name?: string;
  namedetails?: { name?: string };
  extratags?: Record<string, string>;
}

/**
 * Fallback discovery via OpenStreetMap's Nominatim — no ToS issues, no browser.
 * OSM rarely has websites for every business, but it's a dependable backstop
 * when Google Maps returns nothing or breaks.
 */
export async function discoverViaDirectory(
  industry: string,
  location: string,
  limit = 30
): Promise<DiscoveredBusiness[]> {
  const q = `${industry} ${location}`.trim();
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    new URLSearchParams({
      q,
      format: "json",
      addressdetails: "1",
      extratags: "1",
      namedetails: "1",
      limit: String(Math.min(limit, 50)),
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

  return results.map((r) => {
    const tags = r.extratags ?? {};
    const name = r.namedetails?.name || r.name || r.display_name?.split(",")[0] || "Unknown";
    return {
      name: name.trim(),
      website: (tags.website || tags["contact:website"] || tags.url || "").trim(),
      phone: (tags.phone || tags["contact:phone"] || "").trim(),
      email: (tags.email || tags["contact:email"] || "").trim(),
      address: (r.display_name || "").trim(),
      source: "openstreetmap",
    };
  });
}
