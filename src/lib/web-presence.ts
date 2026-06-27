// Classifies a business's online presence so we can surface "no real website"
// leads — no site at all, social-only, or directory-only — as prime new-build
// prospects. Pure logic with no dependencies, so it's safe on client and server.

export type WebPresence = "site" | "social" | "directory" | "none";

/** Social pages — a presence the business doesn't own as a real website. */
const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "linktr.ee",
  "linktree.com",
];

/**
 * Business directories / listing aggregators — sites that post about businesses
 * but aren't a website the business owns. `business.site` is deliberately NOT
 * here: Google's auto-generated mini-sites are treated as a real site.
 */
const DIRECTORY_HOSTS = [
  "yelp.com",
  "yellowpages.com",
  "yellowpages.ca",
  "foursquare.com",
  "bbb.org",
  "angi.com",
  "angieslist.com",
  "thumbtack.com",
  "houzz.com",
  "tripadvisor.com",
  "manta.com",
  "superpages.com",
  "merchantcircle.com",
  "nextdoor.com",
];

/** Pretty platform names for the badge, keyed by bare host. */
const PLATFORM_LABELS: Record<string, string> = {
  "instagram.com": "Instagram",
  "facebook.com": "Facebook",
  "tiktok.com": "TikTok",
  "twitter.com": "Twitter",
  "x.com": "X",
  "linktr.ee": "Linktree",
  "linktree.com": "Linktree",
  "yelp.com": "Yelp",
  "yellowpages.com": "Yellow Pages",
  "yellowpages.ca": "Yellow Pages",
  "foursquare.com": "Foursquare",
  "bbb.org": "BBB",
  "angi.com": "Angi",
  "angieslist.com": "Angi",
  "thumbtack.com": "Thumbtack",
  "houzz.com": "Houzz",
  "tripadvisor.com": "Tripadvisor",
  "manta.com": "Manta",
  "superpages.com": "Superpages",
  "merchantcircle.com": "MerchantCircle",
  "nextdoor.com": "Nextdoor",
};

/** Bare hostname (no `www.`, lowercased), tolerating scheme-less inputs. */
function hostOf(url: string): string | null {
  for (const candidate of [url, `https://${url}`]) {
    try {
      const host = new URL(candidate).hostname.replace(/^www\./, "").toLowerCase();
      if (host.includes(".")) return host;
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

function matches(host: string, list: string[]): boolean {
  return list.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Classify a business's web presence from its (possibly empty) website URL.
 * Blank/unparseable → "none"; a known social host → "social"; a known directory
 * host → "directory"; anything else that resolves to a host → "site".
 */
export function classifyWebPresence(url: string | null | undefined): WebPresence {
  const raw = (url ?? "").trim();
  if (!raw) return "none";
  const host = hostOf(raw);
  if (!host) return "none";
  if (matches(host, SOCIAL_HOSTS)) return "social";
  if (matches(host, DIRECTORY_HOSTS)) return "directory";
  return "site";
}

/** True when a lead has no real, owned website (the new-build pool). */
export function isNoSite(presence: WebPresence): boolean {
  return presence !== "site";
}

/** Short, human label for a lead's web presence — used by the type badge. */
export function webPresenceLabel(presence: WebPresence, website: string): string {
  if (presence === "none") return "No website";
  if (presence === "site") return "Website";
  const host = hostOf(website);
  if (host && PLATFORM_LABELS[host]) return PLATFORM_LABELS[host];
  if (host) {
    const base = host.replace(/\.(com|org|net|ca|co|io)$/, "").split(".").pop() ?? host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return presence === "social" ? "Social" : "Directory";
}
