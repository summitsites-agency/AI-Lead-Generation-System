import "server-only";
import type { DiscoveredBusiness } from "@/lib/types";

export interface DiscoverOptions {
  limit?: number;
  onLog?: (msg: string, level?: "info" | "success" | "warn" | "error") => void;
}

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.displayName",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.formattedAddress",
  "places.rating",
  "places.userRatingCount",
  "nextPageToken",
].join(",");

interface PlacesResult {
  displayName?: { text?: string };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
}

/** True when a Google Places API key is configured. */
export function placesAvailable(): boolean {
  return !!process.env.GOOGLE_PLACES_API_KEY;
}

function mapResult(p: PlacesResult): DiscoveredBusiness {
  return {
    name: (p.displayName?.text ?? "").trim(),
    website: (p.websiteUri ?? "").trim(),
    phone: (p.nationalPhoneNumber ?? "").trim(),
    email: "",
    address: (p.formattedAddress ?? "").trim(),
    rating: p.rating ?? null,
    reviewCount: p.userRatingCount ?? null,
    source: "google places",
  };
}

/**
 * Discover businesses via the Google Places API (Text Search). Structured and
 * hosted-friendly (pure fetch). Paginates up to `limit` (Places caps a page at
 * 20). Throws on a hard API failure so the source chain can fall through.
 */
export async function discoverViaPlaces(
  industry: string,
  location: string,
  opts: DiscoverOptions = {}
): Promise<DiscoveredBusiness[]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY not set");
  const limit = Math.max(1, Math.min(opts.limit ?? 30, 60));
  const log = opts.onLog ?? (() => {});
  const textQuery = `${industry} in ${location}`.trim();

  const out: DiscoveredBusiness[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 3 && out.length < limit; page++) {
    const body: Record<string, unknown> = { textQuery, pageSize: Math.min(limit - out.length, 20) };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Places API ${res.status}: ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { places?: PlacesResult[]; nextPageToken?: string };
    const batch = (data.places ?? []).map(mapResult);
    out.push(...batch);
    log(`Google Places: ${out.length} business(es) so far…`);
    pageToken = data.nextPageToken;
    if (!pageToken || !batch.length) break;
    // New page tokens need a brief moment before they're valid.
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out.slice(0, limit);
}
