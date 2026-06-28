import type { DiscoveredBusiness } from "@/lib/types";
import { canonicalUrl, normalizeUrl, slug } from "@/lib/utils";
import { classifyWebPresence } from "@/lib/web-presence";

/** Contact fields a manual lead should ideally have; blanks become "gaps". */
const CONTACT_FIELDS = ["phone", "email", "address"] as const;

/** Which contact fields on a candidate are still blank. */
export function computeMissing(b: DiscoveredBusiness): string[] {
  return CONTACT_FIELDS.filter((f) => !b[f]?.trim());
}

/**
 * The unique `website` key a lead row should use, matching the discovery
 * pipeline's convention:
 * - real site / social / directory → the canonicalized URL
 * - no web presence → `nowebsite://<name>-<city>` so same-name businesses in
 *   different cities stay distinct.
 */
export function leadKeyFor(website: string, name: string, city: string): string {
  if (classifyWebPresence(website) === "none") {
    return `nowebsite://${slug(name)}-${slug(city)}`;
  }
  return canonicalUrl(website) || normalizeUrl(website) || website;
}
