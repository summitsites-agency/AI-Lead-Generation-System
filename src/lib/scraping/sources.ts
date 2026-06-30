import "server-only";
import type { DiscoveredBusiness } from "@/lib/types";
import type { DiscoverOptions } from "./places";
import { placesAvailable, discoverViaPlaces } from "./places";
import { discoverViaDirectory } from "./directory";

export interface DiscoverySource {
  name: string;
  available(): boolean;
  discover(industry: string, location: string, opts: DiscoverOptions): Promise<DiscoveredBusiness[]>;
}

/**
 * Production discovery chain, highest-quality first:
 *   Google Places (only with a key) → Google Maps scraper (local, Playwright)
 *   → OpenStreetMap (always-on backstop).
 * Google Maps is imported lazily so Playwright never loads on the hosted import
 * path or when Places already satisfied the scan.
 */
export function defaultSources(): DiscoverySource[] {
  return [
    {
      name: "Google Places",
      available: placesAvailable,
      discover: (i, l, o) => discoverViaPlaces(i, l, o),
    },
    {
      name: "Google Maps",
      available: () => true,
      discover: async (i, l, o) => {
        const { discoverViaGoogleMaps } = await import("./google-maps");
        return discoverViaGoogleMaps(i, l, { limit: o.limit, onLog: o.onLog });
      },
    },
    {
      name: "OpenStreetMap",
      available: () => true,
      discover: (i, l, o) => discoverViaDirectory(i, l, o.limit ?? 30),
    },
  ];
}

/** Try each available source in order; return the first non-empty result. */
export async function runSourceChain(
  sources: DiscoverySource[],
  industry: string,
  location: string,
  opts: DiscoverOptions
): Promise<DiscoveredBusiness[]> {
  const log = opts.onLog ?? (() => {});
  for (const src of sources) {
    if (!src.available()) continue;
    try {
      const list = await src.discover(industry, location, opts);
      if (list.length) {
        log(`Found ${list.length} via ${src.name}.`, "success");
        return list;
      }
      log(`${src.name} returned nothing — trying the next source…`, "warn");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log(`${src.name} unavailable (${msg}) — trying the next source…`, "warn");
    }
  }
  return [];
}
