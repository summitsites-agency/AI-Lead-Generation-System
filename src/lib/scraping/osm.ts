import type { DiscoveredBusiness } from "@/lib/types";

/** A single result from OpenStreetMap's Nominatim search API. */
export interface NominatimResult {
  display_name?: string;
  name?: string;
  namedetails?: { name?: string };
  extratags?: Record<string, string>;
}

/**
 * Map a Nominatim result to a DiscoveredBusiness, pulling contact details from
 * OSM tags (with their common aliases) and leaving anything missing blank.
 * Shared by directory discovery and company-name lookup so both produce
 * identical rows.
 */
export function mapOsmResult(r: NominatimResult): DiscoveredBusiness {
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
}
