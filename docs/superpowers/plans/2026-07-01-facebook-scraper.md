# Facebook Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in Facebook discovery source that finds business pages via Google, detects whether each business has a real website (linking it), and surfaces the leads on `/social` with an Instagram/Facebook source filter.

**Architecture:** A new `src/lib/scraping/facebook.ts` module drives the existing local Playwright browser to search Google for `site:facebook.com` business pages, then reads each page's public HTML (parsed with Cheerio) for name, category, contact info, and the business's real website (decoded from `l.facebook.com/l.php?u=` links). Results flow into the existing pipeline as `web_presence: "social"` leads whose `website` field is the FB page URL and whose real site lives in `meta.facebook.website`. The scan wires it in additively behind a scanner checkbox; `/social` gains a source filter.

**Tech Stack:** TypeScript, Next.js 16, Playwright, Cheerio, Vitest, postgres.js.

---

## File Structure

- **Create** `src/lib/scraping/facebook.ts` — the discovery source: pure parsing/analysis helpers + a Playwright orchestrator.
- **Create** `src/lib/scraping/facebook.test.ts` — unit tests for the pure helpers.
- **Modify** `src/lib/types.ts` — `FacebookMeta`, `LeadMeta.facebook`, `DiscoveredBusiness.facebook`.
- **Modify** `src/lib/pipeline.ts` — `ScanRequest.facebook`, additive discover merge, `store()` meta support, Facebook analysis branch.
- **Modify** `src/app/scraper/page.tsx` — "Also search Facebook" checkbox + request body.
- **Modify** `src/lib/db/leads.ts` — `LeadFilter.source` + WHERE condition.
- **Modify** `src/app/api/leads/route.ts` — read `source` query param.
- **Modify** `src/lib/api.ts` — `LeadQuery.source`.
- **Modify** `src/app/social/page.tsx` — source segmented control.
- **Modify** `src/components/lead-drawer.tsx` — "Facebook page" card.

---

## Task 1: Add Facebook types

**Files:**
- Modify: `src/lib/types.ts` (near `LeadMeta` ~line 82 and `DiscoveredBusiness` ~line 20)

- [ ] **Step 1: Add the `FacebookMeta` interface and extend `LeadMeta`**

Find the `LeadMeta` block (currently):

```ts
/** Extra structured data attached to a lead (currently the IG profile snapshot). */
export interface LeadMeta {
  instagram?: InstagramMeta;
}
```

Replace it with:

```ts
/** Public data read from a Facebook business page. */
export interface FacebookMeta {
  /** the Facebook page URL (also stored as the lead's `website`) */
  pageUrl: string;
  /** page category as shown on Facebook, best-effort ("" if unknown) */
  category: string;
  /** the business's real website if one was found on the page, else null */
  website: string | null;
}

/** Extra structured data attached to a lead (IG profile snapshot, FB page data). */
export interface LeadMeta {
  instagram?: InstagramMeta;
  facebook?: FacebookMeta;
}
```

- [ ] **Step 2: Add `facebook` to `DiscoveredBusiness`**

Find the `DiscoveredBusiness` interface and add an optional field after `reviewCount`:

```ts
export interface DiscoveredBusiness {
  name: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  source: string;
  /** Google rating 0–5, when the source provides it. */
  rating?: number | null;
  /** Number of ratings/reviews, when the source provides it. */
  reviewCount?: number | null;
  /** Facebook page data, when discovered via the Facebook source. */
  facebook?: FacebookMeta;
}
```

(`FacebookMeta` is defined in Step 1, same file — order it above `DiscoveredBusiness` if the file requires declaration-before-use; interfaces hoist, so either order type-checks.)

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add FacebookMeta and thread it through Lead/DiscoveredBusiness"
```

---

## Task 2: Facebook pure helpers (TDD)

All parsing/analysis logic lives in pure functions so it's testable without a browser or network. The Playwright orchestrator (Task 3) only fetches HTML and delegates to these.

**Files:**
- Create: `src/lib/scraping/facebook.ts`
- Test: `src/lib/scraping/facebook.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/scraping/facebook.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  buildSearchQuery,
  decodeGoogleUrl,
  parseSearchResults,
  isBusinessPageUrl,
  extractWebsiteFromHtml,
  extractPageFromHtml,
  facebookAnalysis,
} from "./facebook";

describe("buildSearchQuery", () => {
  it("targets facebook.com with industry + location", () => {
    expect(buildSearchQuery("roofing", "Montreal, QC")).toBe(
      "roofing Montreal, QC site:facebook.com"
    );
  });

  it("trims and tolerates a blank location", () => {
    expect(buildSearchQuery("  dentists ", "")).toBe("dentists site:facebook.com");
  });
});

describe("decodeGoogleUrl", () => {
  it("unwraps a Google /url?q= redirect", () => {
    expect(
      decodeGoogleUrl("/url?q=https://www.facebook.com/joesroofing&sa=U&ved=x")
    ).toBe("https://www.facebook.com/joesroofing");
  });

  it("returns a direct href unchanged", () => {
    expect(decodeGoogleUrl("https://www.facebook.com/joesroofing")).toBe(
      "https://www.facebook.com/joesroofing"
    );
  });

  it("returns null for junk", () => {
    expect(decodeGoogleUrl("#")).toBeNull();
    expect(decodeGoogleUrl("")).toBeNull();
  });
});

describe("parseSearchResults", () => {
  const html = `<div id="search">
    <a href="/url?q=https://www.facebook.com/joesroofing&sa=U">Joe's Roofing</a>
    <a href="/url?q=https://www.facebook.com/groups/123&sa=U">A group</a>
    <a href="https://www.facebook.com/acmeplumbing/">Acme Plumbing</a>
    <a href="/url?q=https://example.com/other&sa=U">Not facebook</a>
    <a href="/search?q=more">Google internal</a>
  </div>`;

  it("returns decoded facebook page URLs only, deduped", () => {
    const urls = parseSearchResults(html);
    expect(urls).toContain("https://www.facebook.com/joesroofing");
    expect(urls).toContain("https://www.facebook.com/acmeplumbing/");
    // groups + non-facebook + internal are filtered out
    expect(urls.some((u) => u.includes("/groups/"))).toBe(false);
    expect(urls.some((u) => u.includes("example.com"))).toBe(false);
    expect(urls).toHaveLength(2);
  });
});

describe("isBusinessPageUrl", () => {
  it("keeps real page URLs", () => {
    expect(isBusinessPageUrl("https://www.facebook.com/joesroofing")).toBe(true);
    expect(isBusinessPageUrl("https://facebook.com/Acme.Plumbing.Inc/")).toBe(true);
  });

  it("rejects non-page paths", () => {
    for (const u of [
      "https://www.facebook.com/groups/123",
      "https://www.facebook.com/events/123",
      "https://www.facebook.com/watch/",
      "https://www.facebook.com/profile.php?id=123",
      "https://www.facebook.com/story.php?id=1",
      "https://www.facebook.com/login/",
      "https://www.facebook.com/sharer/sharer.php",
      "https://www.facebook.com/",
      "https://example.com/joes",
    ]) {
      expect(isBusinessPageUrl(u)).toBe(false);
    }
  });
});

describe("extractWebsiteFromHtml", () => {
  it("decodes an l.facebook.com/l.php?u= outbound link", () => {
    const html = `<a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fjoesroofing.com%2F&h=abc">joesroofing.com</a>`;
    expect(extractWebsiteFromHtml(html)).toBe("https://joesroofing.com/");
  });

  it("ignores internal facebook links and returns null", () => {
    const html = `<a href="https://www.facebook.com/joesroofing/about">About</a>`;
    expect(extractWebsiteFromHtml(html)).toBeNull();
  });
});

describe("extractPageFromHtml", () => {
  const html = `<html><head>
    <meta property="og:title" content="Joe&#39;s Roofing" />
    <meta property="og:description" content="Roofing Company in Montreal, QC. Call 514-555-0192 or email hi@joesroofing.com" />
  </head><body>
    <a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fjoesroofing.com%2F&h=abc">Website</a>
  </body></html>`;

  it("pulls name, website, and best-effort contact", () => {
    const biz = extractPageFromHtml(html, "https://www.facebook.com/joesroofing");
    expect(biz.name).toBe("Joe's Roofing");
    expect(biz.source).toBe("facebook");
    expect(biz.website).toBe("https://www.facebook.com/joesroofing");
    expect(biz.facebook?.website).toBe("https://joesroofing.com/");
    expect(biz.email).toBe("hi@joesroofing.com");
    expect(biz.phone).toBe("514-555-0192");
  });

  it("reports website null when no external link is present", () => {
    const biz = extractPageFromHtml(
      `<html><head><meta property="og:title" content="Bob's Plumbing" /></head><body></body></html>`,
      "https://www.facebook.com/bobsplumbing"
    );
    expect(biz.name).toBe("Bob's Plumbing");
    expect(biz.facebook?.website).toBeNull();
  });
});

describe("facebookAnalysis", () => {
  it("scores a no-website page as a top opportunity", () => {
    const a = facebookAnalysis(null);
    expect(a.lead_score).toBe(85);
    expect(a.summary).toMatch(/no real website/i);
  });

  it("scores a page that already has a website lower", () => {
    const a = facebookAnalysis("https://joesroofing.com/");
    expect(a.lead_score).toBe(55);
    expect(a.summary).toMatch(/already has a website/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/scraping/facebook.test.ts`
Expected: FAIL — `Failed to resolve import "./facebook"` (module doesn't exist yet).

- [ ] **Step 3: Implement the pure helpers**

Create `src/lib/scraping/facebook.ts` (Playwright is imported lazily in Task 3, so this file has no top-level Playwright import and its pure helpers are test-safe):

```ts
import "server-only";
import * as cheerio from "cheerio";
import type { Analysis, DiscoveredBusiness, FacebookMeta } from "@/lib/types";
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/scraping/facebook.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scraping/facebook.ts src/lib/scraping/facebook.test.ts
git commit -m "feat(scraping): Facebook page parsing + analysis helpers"
```

---

## Task 3: Facebook Playwright orchestrator

Adds the browser-driven `discoverViaFacebook` to `facebook.ts`. This is browser/network I/O (like `google-maps.ts`, which has no unit tests) — verified by build + a real local scan, not a unit test.

**Files:**
- Modify: `src/lib/scraping/facebook.ts` (append)

- [ ] **Step 1: Append the orchestrator**

Add to the top-of-file imports:

```ts
import type { DiscoverOptions } from "./places";
```

Append at the end of `src/lib/scraping/facebook.ts`:

```ts
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
```

- [ ] **Step 2: Verify it compiles and existing tests still pass**

Run: `npx tsc --noEmit && npx vitest run src/lib/scraping/facebook.test.ts`
Expected: no type errors; Facebook helper tests still PASS (the orchestrator isn't unit-tested).

- [ ] **Step 3: Commit**

```bash
git add src/lib/scraping/facebook.ts
git commit -m "feat(scraping): Playwright-driven Facebook discovery via Google"
```

---

## Task 4: Wire Facebook into the scan pipeline

**Files:**
- Modify: `src/lib/pipeline.ts` (`ScanRequest` ~line 20, `runScan`/`discover` ~line 31/91, `processBusiness` ~line 135, `store` ~line 200)

- [ ] **Step 1: Add `facebook` to `ScanRequest` and import the source**

At the top of `src/lib/pipeline.ts`, add to the imports:

```ts
import { discoverViaFacebook, facebookAnalysis } from "@/lib/scraping/facebook";
import type { LeadMeta } from "@/lib/types";
```

Extend `ScanRequest`:

```ts
export interface ScanRequest {
  mode: "discover" | "import";
  industry?: string;
  location?: string;
  importText?: string;
  limit?: number;
  /** also search Facebook via Google (additive to the normal source chain) */
  facebook?: boolean;
}
```

- [ ] **Step 2: Make `discover()` additive for Facebook**

Replace the `discover()` function body (the discover branch) so Facebook results are concatenated before dedupe. The current `discover()` returns `runSourceChain(...)` directly; change it to:

```ts
async function discover(
  req: ScanRequest,
  industry: string,
  location: string,
  emit: Emit
): Promise<DiscoveredBusiness[]> {
  if (req.mode === "import") {
    const list = parseImport(req.importText ?? "");
    emit({ type: "log", message: `Imported ${list.length} business(es) from your list.` });
    return list;
  }

  const onLog = (message: string, level?: ScanEvent["level"]) =>
    emit({ type: "log", message, level });

  const primary = await runSourceChain(defaultSources(), industry, location, {
    limit: req.limit,
    onLog,
  });

  if (!req.facebook) return primary;

  const fb = await discoverViaFacebook(industry, location, { limit: req.limit, onLog });
  return [...primary, ...fb];
}
```

(`dedupeBusinesses` is already applied to the combined list in `runScan`, so overlaps collapse.)

- [ ] **Step 3: Add `meta` support to `store()`**

Change the `store` signature to accept optional meta and persist it. Update the signature and the `NewLead` object:

```ts
async function store(
  biz: DiscoveredBusiness,
  website: string,
  industry: string,
  location: string,
  source: string,
  a: Analysis,
  presence: WebPresence,
  email = "",
  builder: string | null = null,
  meta: LeadMeta | null = null
): Promise<Lead> {
```

and inside the `NewLead` object literal, add:

```ts
    builder,
    meta,
```

(Add `meta,` right after the existing `builder,` line. `NewLead` already accepts an optional `meta`.)

- [ ] **Step 4: Route Facebook businesses through the social branch with FB analysis + meta**

In `processBusiness`, inside the `if (presence === "social" || presence === "directory")` block, handle Facebook before the generic social handling. Replace that block with:

```ts
  // Social- or directory-only presence (Instagram, Yelp, etc.) — no real website.
  // Keep the actual URL so we can link straight to their page for research.
  if (presence === "social" || presence === "directory") {
    const url = canonicalUrl(biz.website) || normalizeUrl(biz.website) || biz.website;

    // Facebook leads carry their own analysis + page metadata.
    if (biz.source === "facebook" && biz.facebook) {
      const hasSite = biz.facebook.website ? "with a website" : "no website";
      emit({ type: "log", message: `${biz.name}: Facebook page (${hasSite}).` });
      const lead = await store(
        biz,
        url,
        industry,
        location,
        biz.source,
        facebookAnalysis(biz.facebook.website),
        "social",
        biz.email || "",
        null,
        { facebook: biz.facebook }
      );
      return { lead, reachable: false };
    }

    const kind = presence === "social" ? "social page" : "directory listing";
    emit({ type: "log", message: `${biz.name}: ${kind} only — flagging as top opportunity.` });
    const lead = await store(
      biz,
      url,
      industry,
      location,
      biz.source,
      noRealSiteAnalysis(url, presence),
      presence
    );
    return { lead, reachable: false };
  }
```

- [ ] **Step 5: Verify build + full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all existing tests + the Facebook helper tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/pipeline.ts
git commit -m "feat(pipeline): additive Facebook discovery + FB analysis and meta persistence"
```

---

## Task 5: Scanner "Also search Facebook" toggle

**Files:**
- Modify: `src/app/scraper/page.tsx` (state ~line 36, discover body ~line 82, discover panel ~line 158)

- [ ] **Step 1: Add the state**

After `const [limit, setLimit] = useState(30);` add:

```tsx
  const [facebook, setFacebook] = useState(false);
```

- [ ] **Step 2: Include `facebook` in the discover request body**

Change the discover branch of the `body` assignment from:

```tsx
    const body =
      mode === "discover"
        ? { mode, industry, location, limit }
        : { mode, importText };
```

to:

```tsx
    const body =
      mode === "discover"
        ? { mode, industry, location, limit, facebook }
        : { mode, importText };
```

- [ ] **Step 3: Add the checkbox to the discover panel**

Inside the `mode === "discover"` panel, right after the "Max businesses" `<Field>` (the range slider), add:

```tsx
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={facebook}
                  onChange={(e) => setFacebook(e.target.checked)}
                  disabled={running}
                  className="accent-[var(--primary)]"
                />
                Also search Facebook (finds pages with no real website)
              </label>
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: build succeeds (no type or lint errors).

- [ ] **Step 5: Commit**

```bash
git add src/app/scraper/page.tsx
git commit -m "feat(scraper): opt-in 'Also search Facebook' toggle"
```

---

## Task 6: Source filter plumbing (DB → API → client)

**Files:**
- Modify: `src/lib/db/leads.ts` (`LeadFilter` ~line 128, `listLeads` ~line 145)
- Modify: `src/app/api/leads/route.ts` (filter object ~line 11)
- Modify: `src/lib/api.ts` (`LeadQuery` ~line 13)

- [ ] **Step 1: Add `source` to `LeadFilter` and the WHERE clause**

In `src/lib/db/leads.ts`, add to `LeadFilter`:

```ts
  /** filter by lead source, e.g. "instagram" | "facebook" */
  source?: string;
```

In `listLeads`, add a condition alongside the others (e.g. right after the `industry` condition):

```ts
  if (filter.source) conds.push(sql`source = ${filter.source}`);
```

- [ ] **Step 2: Read the `source` param in the leads route**

In `src/app/api/leads/route.ts`, add to the `filter` object:

```ts
    source: sp.get("source") || undefined,
```

- [ ] **Step 3: Add `source` to the client `LeadQuery`**

In `src/lib/api.ts`, add to `LeadQuery`:

```ts
  /** filter by lead source, e.g. "instagram" | "facebook" */
  source?: string;
```

(No change needed to `fetchLeads` — it already serializes every truthy key.)

- [ ] **Step 4: Verify build + tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests PASS.

- [ ] **Step 5: Manually verify the filter end-to-end (dev server)**

Run: `npm run dev`, then in another shell:

```bash
curl -s "http://localhost:3000/api/leads?presence=no_site&source=instagram" | head -c 300
```

Expected: JSON `{ "leads": [ … ] }` containing only leads whose `source` is `"instagram"` (empty array is fine if none exist yet). Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add src/lib/db/leads.ts src/app/api/leads/route.ts src/lib/api.ts
git commit -m "feat(leads): filter leads by source"
```

---

## Task 7: `/social` source filter UI

**Files:**
- Modify: `src/app/social/page.tsx` (state ~line 22, `load` ~line 25, controls row ~line 60)

- [ ] **Step 1: Add the `source` state**

After `const [search, setSearch] = useState("");` add:

```tsx
  const [source, setSource] = useState("");
```

- [ ] **Step 2: Pass `source` into the fetch and its deps**

Change the `load` callback from:

```tsx
  const load = useCallback(() => {
    setLoading(true);
    fetchLeads({ presence: "no_site", sort, search })
      .then(setLeads)
      .finally(() => setLoading(false));
  }, [sort, search]);
```

to:

```tsx
  const load = useCallback(() => {
    setLoading(true);
    fetchLeads({ presence: "no_site", sort, search, source })
      .then(setLeads)
      .finally(() => setLoading(false));
  }, [sort, search, source]);
```

- [ ] **Step 3: Add the segmented control**

Above the existing controls row (the `<div className="flex flex-col gap-2 …">` that holds search + sort), add a segmented control matching the scraper's tab style:

```tsx
      <div className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1 text-xs font-medium">
        {[
          { value: "", label: "All" },
          { value: "instagram", label: "Instagram" },
          { value: "facebook", label: "Facebook" },
        ].map((s) => (
          <button
            key={s.value}
            onClick={() => setSource(s.value)}
            className={cn(
              "flex-1 rounded-md px-2.5 py-1.5 transition-colors",
              source === s.value
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
```

- [ ] **Step 4: Add the `cn` import**

Ensure `cn` is imported at the top of the file. Change:

```tsx
import { fetchLeads, deleteLead } from "@/lib/api";
```

to add the utils import on the following line:

```tsx
import { fetchLeads, deleteLead } from "@/lib/api";
import { cn } from "@/lib/utils";
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/social/page.tsx
git commit -m "feat(social): All/Instagram/Facebook source filter"
```

---

## Task 8: Lead drawer "Facebook page" card

**Files:**
- Modify: `src/components/lead-drawer.tsx` (`DrawerBody` — derive `fb` ~line 162, render card ~before the Instagram card ~line 230)

- [ ] **Step 1: Derive the Facebook meta**

In `DrawerBody`, next to `const ig = lead.meta?.instagram;` add:

```tsx
  const fb = lead.meta?.facebook;
```

- [ ] **Step 2: Render the card**

Immediately before the Instagram preview card (`{ig && (`), add the Facebook card:

```tsx
        {/* Facebook page card */}
        {fb && (
          <section className="space-y-2">
            <SectionTitle icon={<ExternalLink size={14} />}>Facebook page</SectionTitle>
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="truncate font-semibold">{lead.name}</div>
              {fb.category && (
                <div className="text-xs text-text-muted">{fb.category}</div>
              )}
              <div className="mt-3 text-sm">
                {fb.website ? (
                  <a
                    href={fb.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 break-all text-primary hover:underline"
                  >
                    <ExternalLink size={12} className="shrink-0" /> {fb.website}
                  </a>
                ) : (
                  <span className="text-warning">No website — prime new-build lead</span>
                )}
              </div>
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-fill px-3 py-1.5 text-xs font-medium hover:bg-fill-strong"
              >
                <ExternalLink size={13} /> Open on Facebook
              </a>
            </div>
          </section>
        )}
```

(`ExternalLink` and `SectionTitle` are already imported/defined in this file.)

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/lead-drawer.tsx
git commit -m "feat(drawer): Facebook page card with website / no-website indicator"
```

---

## Task 9: Final verification

- [ ] **Step 1: Run the full test suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS; production build succeeds.

- [ ] **Step 2: Smoke-test a real Facebook scan (local)**

Ensure `NEXT_PUBLIC_SCRAPER_ENABLED=true` and `HEADLESS=false` (to watch it) in `.env`, then `npm run dev`. On `/scraper`, pick "Google Maps" (discover) mode, enter an industry + location, tick **Also search Facebook**, and Start scan. Confirm the live log shows the Google search + page reads, and that Facebook leads appear.

Then on `/social`: confirm the leads show up, the **Facebook** filter narrows to them, and opening one shows the **Facebook page** card with either a linked website or "No website — prime new-build lead".

- [ ] **Step 3: Note any deviations**

If the live scan reveals that Google markup or Facebook's login gate breaks parsing, capture the observed HTML and refine `parseSearchResults` / `extractWebsiteFromHtml` with a new fixture-based test in `facebook.test.ts` before adjusting the code (keep TDD).

---

## Self-Review Notes

- **Spec coverage:** discovery source (T2/T3), Google via Playwright (T3), additive opt-in (T4/T5), website detection + link (T2 `extractWebsiteFromHtml`, T8 card), honest scoring split (T2 `facebookAnalysis`), `/social` filter (T6/T7), FB leads on `/social` via `web_presence:"social"` (T4). ✔
- **Type consistency:** `FacebookMeta { pageUrl, category, website }` defined once (T1) and used identically in `extractPageFromHtml`, `store`, and the drawer. `discoverViaFacebook`/`facebookAnalysis` names match between definition (T2/T3) and import (T4). ✔
- **Known limitation:** `listLeads` source filter isn't unit-tested (no DB harness in Vitest); covered by build + the Task 6 curl check, consistent with the spec's note.
