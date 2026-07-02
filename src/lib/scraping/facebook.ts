import "server-only";
import * as cheerio from "cheerio";
import type { Analysis, DiscoveredBusiness, FacebookMeta } from "@/lib/types";
import type { DiscoverOptions } from "./places";
import { extractContactFromBio } from "./instagram";

/** Build the Google query that finds public Facebook business pages. */
export function buildSearchQuery(industry: string, location: string): string {
  return `${industry.trim()} ${location.trim()}`.trim() + " site:facebook.com";
}

/**
 * Turn a Google result href into a real URL. Handles both the `/url?q=…`
 * redirect wrapper and direct hrefs. Returns null for internal/junk links.
 */
export function decodeGoogleUrl(href: string): string | null {
  const raw = (href ?? "").trim();
  if (!raw || raw.startsWith("#")) return null;
  try {
    const u = new URL(raw, "https://www.google.com");
    if (u.pathname === "/url") {
      const target = u.searchParams.get("q") || u.searchParams.get("url");
      return target ? target : null;
    }
    // Direct external link (Google sometimes renders these).
    if (/^https?:$/.test(u.protocol) && u.hostname !== "www.google.com") {
      return u.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/** Bare hostname (lowercased, no leading www.), or null. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when a Facebook URL points at a real business page (not a group, event,
 * profile.php, login, sharer, the bare domain, etc.).
 */
export function isBusinessPageUrl(url: string): boolean {
  const host = hostOf(url);
  if (host !== "facebook.com") return false;
  let path: string;
  try {
    path = new URL(url).pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
  if (!path || path === "") return false;
  const first = path.split("/").filter(Boolean)[0] ?? "";
  const blocked = new Set([
    "groups", "events", "watch", "photo", "photos", "story.php",
    "profile.php", "login", "sharer", "sharer.php", "pages", "marketplace",
    "help", "policies", "reel", "reels", "media", "public",
  ]);
  return !blocked.has(first);
}

/** Collect decoded, business-page-only Facebook URLs from a Google results page. */
export function parseSearchResults(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const decoded = decodeGoogleUrl(href);
    if (decoded && isBusinessPageUrl(decoded)) seen.add(decoded);
  });
  return Array.from(seen);
}

/** Meta content by property/name attribute (Cheerio decodes entities for us). */
function meta($: cheerio.CheerioAPI, key: string): string {
  return (
    $(`meta[property="${key}"]`).attr("content") ??
    $(`meta[name="${key}"]`).attr("content") ??
    ""
  ).trim();
}

/**
 * Find the business's real website on a Facebook page: decode any
 * `l.facebook.com/l.php?u=<encoded>` outbound link to the first external
 * (non-facebook) URL. Returns null when only internal links exist.
 */
export function extractWebsiteFromHtml(html: string): string | null {
  const $ = cheerio.load(html);
  let found: string | null = null;
  $("a").each((_, el) => {
    if (found) return;
    const href = $(el).attr("href") ?? "";
    const m = href.match(/l\.php\?u=([^&]+)/);
    if (!m) return;
    let target: string;
    try {
      target = decodeURIComponent(m[1]);
    } catch {
      return;
    }
    const host = hostOf(target);
    if (host && host !== "facebook.com" && !host.endsWith(".facebook.com")) {
      found = target;
    }
  });
  return found;
}

/** Category, best-effort, from the og:description tail (e.g. "… . Roofing Company in …"). */
function extractCategory(description: string): string {
  const m = description.match(/·\s*([A-Za-z][A-Za-z /&'-]+?)(?:\s+in\s|\.|$)/);
  return m ? m[1].trim() : "";
}

/** Decode a couple of common HTML entities left in a title. */
function decodeTitle(s: string): string {
  return s
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}

/** Build a DiscoveredBusiness from a Facebook page's HTML. Pure: no network. */
export function extractPageFromHtml(html: string, pageUrl: string): DiscoveredBusiness {
  const $ = cheerio.load(html);
  const name = decodeTitle(meta($, "og:title")) || pageUrl;
  const description = meta($, "og:description");
  const category = extractCategory(description);
  const website = extractWebsiteFromHtml(html);
  const contact = extractContactFromBio(description);
  const facebook: FacebookMeta = { pageUrl, category, website };
  return {
    name,
    website: pageUrl,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    address: "",
    source: "facebook",
    facebook,
  };
}

/**
 * Deterministic opportunity analysis for a Facebook lead. A page with no real
 * website is a prime new-build lead; one that already has a site is a weaker
 * redesign/SEO lead.
 */
export function facebookAnalysis(website: string | null): Analysis {
  if (!website) {
    return {
      design_score: 2,
      seo_score: 1,
      conversion_score: 2,
      issues: [
        "Runs on a Facebook page instead of a real website",
        "No owned domain, weak search visibility, limited lead capture",
      ],
      opportunities: [
        "Build a dedicated website they own and control",
        "Add SEO, lead forms and analytics a Facebook page can't provide",
      ],
      summary:
        "This business runs on a Facebook page with no real website — a strong candidate for a new build.",
      lead_score: 85,
      engine: "fallback",
    };
  }
  return {
    design_score: 4,
    seo_score: 3,
    conversion_score: 4,
    issues: [
      `Already has a website (${website}) — new build is a harder sell`,
      "Facebook presence may be stronger than the site itself",
    ],
    opportunities: [
      "Pitch a redesign or SEO/conversion overhaul of the existing site",
      "Tighten the Facebook-to-website funnel",
    ],
    summary: `This business already has a website (${website}) — a redesign / SEO angle rather than a from-scratch build.`,
    lead_score: 55,
    engine: "fallback",
  };
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/**
 * Discover Facebook business pages for `industry in location` via Google, then
 * read each public page for name/category/contact and the business's real
 * website. Best-effort and resilient: returns [] (logging a warning) if Google
 * blocks us, and skips individual pages that fail. Local-only (needs Playwright).
 */
export async function discoverViaFacebook(
  industry: string,
  location: string,
  opts: DiscoverOptions = {}
): Promise<DiscoveredBusiness[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 30, 60));
  const log = opts.onLog ?? (() => {});
  const headless = (process.env.HEADLESS ?? "true").toLowerCase() !== "false";

  let browser: import("playwright").Browser | null = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      userAgent: UA,
      locale: "en-US",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    const query = buildSearchQuery(industry, location);
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=en&num=30`;
    log(`Searching Google for Facebook pages: "${query}"…`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });

    // Google's EU consent interstitial, when present.
    const consent = page
      .getByRole("button", { name: /accept all|reject all|i agree/i })
      .first();
    if (await consent.isVisible().catch(() => false)) {
      await consent.click().catch(() => {});
      await page.waitForTimeout(800);
    }

    const urls = parseSearchResults(await page.content()).slice(0, limit);
    if (!urls.length) {
      log("Google returned no Facebook pages (blocked or no matches).", "warn");
      return [];
    }
    log(`Found ${urls.length} Facebook page(s); reading each…`, "success");

    const businesses: DiscoveredBusiness[] = [];
    for (const pageUrl of urls) {
      try {
        await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
        businesses.push(extractPageFromHtml(await page.content(), pageUrl));
      } catch {
        // A single page failing shouldn't abort discovery.
        businesses.push({
          name: pageUrl,
          website: pageUrl,
          phone: "",
          email: "",
          address: "",
          source: "facebook",
          facebook: { pageUrl, category: "", website: null },
        });
      }
    }
    return businesses;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log(`Facebook discovery unavailable (${msg}).`, "warn");
    return [];
  } finally {
    await browser?.close().catch(() => {});
  }
}
