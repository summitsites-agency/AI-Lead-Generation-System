// Best-effort public Instagram profile reader. Instagram fights scraping, so
// this is intentionally forgiving: it pulls the Open Graph preview tags that
// Instagram exposes to link crawlers (follower/following/post counts, name,
// bio) and gives up gracefully when blocked, leaving the UI to ask the user.

/** Signals read from a public Instagram profile. `ok` is false when blocked. */
export interface InstagramProfile {
  handle: string;
  url: string;
  ok: boolean;
  name: string;
  followers: number | null;
  following: number | null;
  posts: number | null;
  bio: string;
  externalUrl: string | null;
  /** profile photo URL (og:image), for the preview card */
  avatar: string | null;
  /** contact details pulled out of the bio, like the website scraper does */
  email: string | null;
  phone: string | null;
  error?: string;
}

/** Details a user can type in by hand when the auto-read is blocked. */
export interface InstagramManualInput {
  followers?: number;
  posts?: number;
  bio?: string;
  niche?: string;
}

const CRAWLER_UA =
  "Mozilla/5.0 (compatible; SummitSitesBot/1.0; +https://summitsites.local) facebookexternalhit/1.1";

/**
 * Normalize whatever the user typed (handle, @handle, or a full instagram URL)
 * into a bare handle, or null if it isn't a plausible Instagram username.
 */
export function normalizeHandle(input: string): string | null {
  let v = (input ?? "").trim();
  if (!v) return null;

  if (/instagram\.com/i.test(v)) {
    try {
      const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
      v = u.pathname.split("/").filter(Boolean)[0] ?? "";
    } catch {
      return null;
    }
  }

  v = v.replace(/^@/, "").trim();
  return /^[A-Za-z0-9._]{1,30}$/.test(v) ? v : null;
}

export function profileUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

/** Parse "12.3k" / "1,234" / "1.2m" into a number, or null. */
export function parseCount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*([km])?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const mult = m[2] === "m" ? 1_000_000 : m[2] === "k" ? 1_000 : 1;
  return Math.round(n * mult);
}

/**
 * Pull "N Followers, M Following, K Posts" out of an og:description string.
 * Returns nulls for any piece it can't find.
 */
export function parseProfileStats(desc: string): {
  followers: number | null;
  following: number | null;
  posts: number | null;
} {
  const num = "([\\d.,]+[km]?)";
  const grab = (label: string) => {
    const re = new RegExp(`${num}\\s+${label}`, "i");
    const m = desc.match(re);
    return m ? parseCount(m[1]) : null;
  };
  return {
    followers: grab("Followers"),
    following: grab("Following"),
    posts: grab("Posts"),
  };
}

function fromCodePoint(cp: number): string {
  try {
    return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : "";
  } catch {
    return "";
  }
}

/** Decode HTML entities — named plus decimal (&#39;) and hex (&#x2019;). */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * Turn an Instagram display name into a plain business name: decode entities,
 * normalize curly quotes, and strip decorative emoji/symbols (e.g.
 * "✨Cake O’Clock Montreal✨" -> "Cake O'Clock Montreal").
 */
export function cleanName(raw: string): string {
  let s = decodeEntities(raw);
  s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
  // Emoji, dingbats, arrows, symbols, variation selectors, zero-width joiners.
  s = s.replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu,
    ""
  );
  // Collapse whitespace and trim leftover separators/punctuation.
  return s.replace(/\s+/g, " ").replace(/^[\s\-–—|·•]+|[\s\-–—|·•]+$/g, "").trim();
}

/** Pull an email and/or phone number out of a free-text bio (best-effort). */
export function extractContactFromBio(bio: string): {
  email: string | null;
  phone: string | null;
} {
  const email = bio.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0] ?? null;

  let phone: string | null = null;
  const m = bio.match(/\+?\d[\d\s().\-]{6,}\d/);
  if (m) {
    const digits = m[0].replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) phone = m[0].trim();
  }
  return { email, phone };
}

function metaContent(html: string, property: string): string {
  // Match either order of property/content attributes.
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${property}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1]);
  }
  return "";
}

/**
 * Extract a profile from raw profile-page HTML. Pure: no network. Returns
 * `ok: false` when the page carries none of the expected preview data.
 */
export function extractProfileFromHtml(
  html: string,
  handle: string
): InstagramProfile {
  const url = profileUrl(handle);
  const ogDesc = metaContent(html, "og:description") || metaContent(html, "description");
  const ogTitle = metaContent(html, "og:title");
  const stats = parseProfileStats(ogDesc);

  const hasSignal =
    stats.followers != null || stats.posts != null || /\(@/.test(ogTitle);
  if (!hasSignal) {
    return blocked(handle, "no preview data on page");
  }

  // Name: "Display Name (@handle) • Instagram photos and videos"
  let name = "";
  const titleMatch = ogTitle.match(/^(.*?)\s*\(@/);
  if (titleMatch) name = cleanName(titleMatch[1]);

  // Bio: og:description sometimes ends with: ... on Instagram: "bio text"
  let bio = "";
  const bioMatch = ogDesc.match(/Instagram:\s*["“”](.+?)["“”]\s*$/);
  if (bioMatch) bio = bioMatch[1].trim();

  // External link in bio, if Instagram left it in the embedded JSON.
  let externalUrl: string | null = null;
  const ext = html.match(/"external_url":"([^"]+)"/);
  if (ext) externalUrl = ext[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/") || null;

  // Profile photo for the preview card.
  const avatar = metaContent(html, "og:image") || null;

  const contact = extractContactFromBio(bio);

  return {
    handle,
    url,
    ok: true,
    name: name || `@${handle}`,
    followers: stats.followers,
    following: stats.following,
    posts: stats.posts,
    bio,
    externalUrl,
    avatar,
    email: contact.email,
    phone: contact.phone,
  };
}

function blocked(handle: string, error: string): InstagramProfile {
  return {
    handle,
    url: profileUrl(handle),
    ok: false,
    name: `@${handle}`,
    followers: null,
    following: null,
    posts: null,
    bio: "",
    externalUrl: null,
    avatar: null,
    email: null,
    phone: null,
    error,
  };
}

async function fetchHtml(url: string, ua: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Load the profile in a real browser as a fallback when plain fetch is blocked. */
async function scrapeWithBrowser(handle: string): Promise<InstagramProfile> {
  const headless = (process.env.HEADLESS ?? "true").toLowerCase() !== "false";
  let browser: import("playwright").Browser | null = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({ locale: "en-US" });
    const page = await context.newPage();
    await page.goto(profileUrl(handle), { waitUntil: "domcontentloaded", timeout: 30_000 });
    const html = await page.content();
    return extractProfileFromHtml(html, handle);
  } catch (e) {
    return blocked(handle, e instanceof Error ? e.message : "browser failed");
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Best-effort read of a public Instagram profile: try a cheap crawler-style
 * fetch first, then fall back to a real browser. Returns `ok: false` when the
 * profile can't be read (private, blocked, or removed) so callers can ask the
 * user to fill in the details by hand.
 */
export async function scrapeInstagramProfile(handle: string): Promise<InstagramProfile> {
  const html = await fetchHtml(profileUrl(handle), CRAWLER_UA);
  if (html) {
    const profile = extractProfileFromHtml(html, handle);
    if (profile.ok) return profile;
  }
  return scrapeWithBrowser(handle);
}
