# Finding-Leads Efficiency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make lead discovery reliable and demand-aware — add an opt-in Google Places source, rank leads by business-value × website-weakness, detect the site builder, and crawl a couple of internal pages to capture contact emails.

**Architecture:** Discovery becomes an ordered source-adapter chain (Places → Maps scraper → OSM) selected by availability. A new `valueScore` axis is stored per lead and combined with the existing weakness `lead_score` at sort time. Builder detection and a small same-origin contact crawl enrich each scraped site. UI changes are limited to one table column, a couple of drawer fields, and one sort option.

**Tech Stack:** Next.js 16 API routes, TypeScript, postgres.js (Supabase), cheerio, Playwright (lazy), vitest. Postgres-only — there is **no** active SQLite path.

---

## File Structure

- `src/lib/scoring.ts` (modify) — add `valueScore`, `rankScore`, `isDiyBuilder`.
- `src/lib/scoring.test.ts` (modify) — tests for the above.
- `src/lib/scraping/parse.ts` (modify) — add `detectBuilder`, set `builder` on signals.
- `src/lib/scraping/parse.test.ts` (modify) — builder-detection tests.
- `src/lib/scraping/places.ts` (create) — Google Places source.
- `src/lib/scraping/places.test.ts` (create) — Places mapping + availability tests.
- `src/lib/scraping/sources.ts` (create) — `DiscoverySource` interface + ordered chain runner.
- `src/lib/scraping/sources.test.ts` (create) — chain selection tests.
- `src/lib/scraping/site.ts` (modify) — conditional same-origin contact crawl.
- `src/lib/scraping/site.test.ts` (create) — crawl/merge tests (mocked fetch).
- `src/lib/types.ts` (modify) — new optional discovery fields + Lead fields.
- `src/lib/db/leads.ts` (modify) — row mapping, upsert defaults, `rank` sort.
- `supabase/schema.sql` (modify) — new columns + idempotent ALTERs.
- `src/lib/pipeline.ts` (modify) — use the source chain; thread demand/builder into `store`.
- `src/app/api/leads/route.ts` (modify) — default sort `rank`.
- `src/app/leads/page.tsx` (modify) — add `Rank` sort option, make it default.
- `src/components/lead-table.tsx` (modify) — rating/review column.
- `src/components/lead-drawer.tsx` (modify) — rating/reviews + builder display.
- `README.md` (modify) — document `GOOGLE_PLACES_API_KEY`.

---

## Task 1: Scoring — value & rank functions

**Files:**
- Modify: `src/lib/scoring.ts`
- Test: `src/lib/scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/scoring.test.ts`:

```ts
import { valueScore, rankScore, isDiyBuilder } from "./scoring";

describe("valueScore", () => {
  it("returns the neutral baseline when review data is absent", () => {
    expect(valueScore(null, null, null)).toBe(50);
  });

  it("rises with review count and rating", () => {
    const busy = valueScore(4.5, 200, null);
    const dead = valueScore(4.5, 2, null);
    expect(busy).toBeGreaterThan(dead);
    expect(busy).toBeLessThanOrEqual(100);
    expect(dead).toBeGreaterThanOrEqual(0);
  });

  it("adds a boost for DIY website builders", () => {
    expect(valueScore(null, null, "Wix")).toBe(60);
    expect(valueScore(null, null, "WordPress")).toBe(50);
  });
});

describe("rankScore", () => {
  it("ranks a busy bad site above a dead bad site above a busy good site", () => {
    const busyBad = rankScore(80, valueScore(4.5, 200, null));
    const deadBad = rankScore(80, valueScore(4.5, 2, null));
    const busyGood = rankScore(20, valueScore(4.5, 200, null));
    expect(busyBad).toBeGreaterThan(deadBad);
    expect(deadBad).toBeGreaterThan(busyGood);
  });
});

describe("isDiyBuilder", () => {
  it("flags owner-built platforms only", () => {
    expect(isDiyBuilder("Wix")).toBe(true);
    expect(isDiyBuilder("Squarespace")).toBe(true);
    expect(isDiyBuilder("WordPress")).toBe(false);
    expect(isDiyBuilder(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: FAIL — `valueScore`/`rankScore`/`isDiyBuilder` is not exported.

- [ ] **Step 3: Implement the functions**

Append to `src/lib/scoring.ts`:

```ts
/** Website builders that strongly imply the owner built the site themselves. */
const DIY_BUILDERS = new Set(["wix", "squarespace", "godaddy", "weebly"]);

export function isDiyBuilder(builder: string | null | undefined): boolean {
  return !!builder && DIY_BUILDERS.has(builder.toLowerCase());
}

/**
 * Business-value score 0–100: how much demand/reputation a business has, i.e.
 * how worthwhile it is to win. Driven by review volume (log-scaled) and rating,
 * with a small boost for DIY-builder sites. When review data is absent (the free
 * discovery path), returns a neutral baseline so ranking degrades to weakness-only.
 */
export function valueScore(
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
  builder: string | null | undefined
): number {
  const boost = isDiyBuilder(builder) ? 10 : 0;
  if (reviewCount === null || reviewCount === undefined) {
    return clamp(50 + boost, 0, 100);
  }
  const reviews = Math.min(70, Math.round(Math.log10(reviewCount + 1) * 23));
  const rep = rating !== null && rating !== undefined ? Math.round((rating / 5) * 20) : 10;
  return clamp(reviews + rep + boost, 0, 100);
}

/**
 * Combined sort key: opportunity (website weakness) scaled by business value.
 * Higher = call this lead first. The list query computes the same product in SQL;
 * this function exists for clarity and tests.
 */
export function rankScore(leadScore: number, value: number): number {
  return leadScore * value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/scoring.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scoring.ts src/lib/scoring.test.ts
git commit -m "feat(scoring): add value-score and rank-score axes"
```

---

## Task 2: Builder / tech-stack detection

**Files:**
- Modify: `src/lib/types.ts` (add `builder` to `SiteSignals`)
- Modify: `src/lib/scraping/parse.ts`
- Test: `src/lib/scraping/parse.test.ts`

- [ ] **Step 1: Add the optional field to `SiteSignals`**

In `src/lib/types.ts`, inside `interface SiteSignals`, add after `bytes: number;`:

```ts
  /** Detected site builder / CMS (e.g. "Wix", "WordPress"), or null. */
  builder?: string | null;
```

(Optional, so existing `SiteSignals` literals in `site.ts`/tests keep compiling.)

- [ ] **Step 2: Write the failing tests**

Append to `src/lib/scraping/parse.test.ts`:

```ts
import { detectBuilder } from "./parse";

describe("detectBuilder", () => {
  it("detects common builders from markup", () => {
    expect(detectBuilder(`<link href="/wp-content/themes/x/style.css">`)).toBe("WordPress");
    expect(detectBuilder(`<script src="https://static.parastorage.com/x.js"></script>`)).toBe("Wix");
    expect(detectBuilder(`<div class="sqs-block">`.concat("squarespace-cdn.com"))).toBe("Squarespace");
    expect(detectBuilder(`<script src="https://cdn.shopify.com/s/x.js">`)).toBe("Shopify");
    expect(detectBuilder(`<img src="https://img1.wsimg.com/x.png">`)).toBe("GoDaddy");
  });

  it("returns null when no builder markers are present", () => {
    expect(detectBuilder(`<html><body><h1>Hand coded</h1></body></html>`)).toBeNull();
  });

  it("is surfaced on parsed signals", () => {
    const html = `<!doctype html><html><head><title>x</title></head><body><link href="/wp-includes/x.css"></body></html>`;
    expect(parseSignals(html, "https://x.test", 100).builder).toBe("WordPress");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/scraping/parse.test.ts`
Expected: FAIL — `detectBuilder` is not exported.

- [ ] **Step 4: Implement `detectBuilder` and wire it in**

In `src/lib/scraping/parse.ts`, add this exported function above `parseSignals`:

```ts
/**
 * Best-effort site-builder / CMS detection from raw HTML markup. Checks the most
 * reliable fingerprints (asset hosts, generator tag, well-known paths). Order
 * matters — more specific platforms are checked before generic ones.
 */
export function detectBuilder(html: string): string | null {
  const h = html.toLowerCase();
  if (h.includes("wp-content") || h.includes("wp-includes") || /generator["'][^>]*wordpress/i.test(html))
    return "WordPress";
  if (h.includes("static.parastorage.com") || h.includes("_wixcss") || h.includes("wix.com"))
    return "Wix";
  if (h.includes("squarespace-cdn.com") || h.includes("static1.squarespace.com") || h.includes("squarespace.com"))
    return "Squarespace";
  if (h.includes("cdn.shopify.com") || h.includes("myshopify.com")) return "Shopify";
  if (h.includes("img1.wsimg.com") || h.includes("godaddy")) return "GoDaddy";
  if (h.includes("weebly.com") || h.includes("editmysite.com")) return "Weebly";
  if (h.includes("webflow.io") || h.includes("assets.website-files.com")) return "Webflow";
  return null;
}
```

Then in `parseSignals`, in the returned object, add `builder` after `bytes`:

```ts
    bytes: Buffer.byteLength(html),
    builder: detectBuilder(html),
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/scraping/parse.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/scraping/parse.ts src/lib/scraping/parse.test.ts
git commit -m "feat(scraping): detect site builder / CMS from markup"
```

---

## Task 3: Google Places discovery source

**Files:**
- Modify: `src/lib/types.ts` (add optional `rating`/`reviewCount` to `DiscoveredBusiness`)
- Create: `src/lib/scraping/places.ts`
- Test: `src/lib/scraping/places.test.ts`

- [ ] **Step 1: Extend `DiscoveredBusiness`**

In `src/lib/types.ts`, inside `interface DiscoveredBusiness`, add after `source: string;`:

```ts
  /** Google rating 0–5, when the source provides it. */
  rating?: number | null;
  /** Number of ratings/reviews, when the source provides it. */
  reviewCount?: number | null;
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/scraping/places.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { placesAvailable, discoverViaPlaces } from "./places";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("placesAvailable", () => {
  it("is false without a key and true with one", () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(placesAvailable()).toBe(false);
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
    expect(placesAvailable()).toBe(true);
  });
});

describe("discoverViaPlaces", () => {
  it("maps Places results to DiscoveredBusiness with demand signals", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          places: [
            {
              displayName: { text: "Acme Roofing" },
              websiteUri: "https://acme.test",
              nationalPhoneNumber: "(514) 555-1234",
              formattedAddress: "1 Main St, Montreal",
              rating: 4.6,
              userRatingCount: 182,
            },
            { displayName: { text: "No Site Co" } },
          ],
        }),
      }))
    );

    const list = await discoverViaPlaces("roofing", "Montreal", { limit: 10 });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      name: "Acme Roofing",
      website: "https://acme.test",
      phone: "(514) 555-1234",
      address: "1 Main St, Montreal",
      rating: 4.6,
      reviewCount: 182,
      source: "google places",
    });
    expect(list[1]).toMatchObject({ name: "No Site Co", website: "", rating: null, reviewCount: null });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/scraping/places.test.ts`
Expected: FAIL — cannot find module `./places`.

- [ ] **Step 4: Implement the Places source**

Create `src/lib/scraping/places.ts`:

```ts
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/scraping/places.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/scraping/places.ts src/lib/scraping/places.test.ts
git commit -m "feat(scraping): add Google Places discovery source (opt-in)"
```

---

## Task 4: Ordered source chain

**Files:**
- Create: `src/lib/scraping/sources.ts`
- Test: `src/lib/scraping/sources.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/scraping/sources.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { runSourceChain, type DiscoverySource } from "./sources";
import type { DiscoveredBusiness } from "@/lib/types";

function biz(name: string): DiscoveredBusiness {
  return { name, website: "", phone: "", email: "", address: "", source: "test" };
}
function source(name: string, available: boolean, result: DiscoveredBusiness[] | Error): DiscoverySource {
  return {
    name,
    available: () => available,
    discover: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

describe("runSourceChain", () => {
  it("returns the first available source that yields results", async () => {
    const chain = [
      source("a", false, [biz("skip")]),
      source("b", true, []),
      source("c", true, [biz("hit")]),
    ];
    const list = await runSourceChain(chain, "roofing", "Montreal", {});
    expect(list.map((b) => b.name)).toEqual(["hit"]);
  });

  it("falls through when a source throws", async () => {
    const chain = [
      source("a", true, new Error("boom")),
      source("b", true, [biz("recovered")]),
    ];
    const list = await runSourceChain(chain, "x", "y", {});
    expect(list.map((b) => b.name)).toEqual(["recovered"]);
  });

  it("returns empty when nothing yields", async () => {
    const chain = [source("a", false, []), source("b", true, [])];
    expect(await runSourceChain(chain, "x", "y", {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/scraping/sources.test.ts`
Expected: FAIL — cannot find module `./sources`.

- [ ] **Step 3: Implement the chain**

Create `src/lib/scraping/sources.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/scraping/sources.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scraping/sources.ts src/lib/scraping/sources.test.ts
git commit -m "feat(scraping): ordered discovery source chain (Places > Maps > OSM)"
```

---

## Task 5: Deeper contact crawl in site.ts

**Files:**
- Modify: `src/lib/scraping/site.ts`
- Test: `src/lib/scraping/site.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `src/lib/scraping/site.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { scrapeSite } from "./site";

function htmlResponse(html: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "text/html" : null) },
    text: async () => html,
  };
}

const HOME_NO_EMAIL = `<!doctype html><html><head><title>Acme</title></head>
  <body><h1>Acme</h1><a href="/contact">Contact</a></body></html>`;
const CONTACT_WITH_EMAIL = `<!doctype html><html><head><title>Contact</title></head>
  <body><a href="mailto:hello@acme.test">Email us</a></body></html>`;
const HOME_WITH_EMAIL = `<!doctype html><html><head><title>Acme</title></head>
  <body><a href="mailto:owner@acme.test">Email</a></body></html>`;

afterEach(() => vi.unstubAllGlobals());

describe("scrapeSite contact crawl", () => {
  it("fetches /contact and merges the email when the homepage has none", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/contact") ? htmlResponse(CONTACT_WITH_EMAIL) : htmlResponse(HOME_NO_EMAIL)
    );
    vi.stubGlobal("fetch", fetchMock);

    const s = await scrapeSite("https://acme.test");
    expect(s.contactEmail).toBe("hello@acme.test");
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toContain("https://acme.test/contact");
  });

  it("does not crawl extra pages when the homepage already has an email", async () => {
    const fetchMock = vi.fn(async () => htmlResponse(HOME_WITH_EMAIL));
    vi.stubGlobal("fetch", fetchMock);

    const s = await scrapeSite("https://acme.test");
    expect(s.contactEmail).toBe("owner@acme.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/scraping/site.test.ts`
Expected: FAIL — homepage-only `scrapeSite` never fetches `/contact`, so the first test fails on the missing email.

- [ ] **Step 3: Implement the conditional crawl**

In `src/lib/scraping/site.ts`, rename the current `scrapeSite` body into a private helper and add the crawl. Replace the existing `scrapeSite` function (lines 56–67) with:

```ts
/** Fetch one URL with a single retry (spec §10: "Timeout → retry once"). */
async function fetchWithRetry(url: string): Promise<SiteSignals> {
  try {
    return await fetchOnce(url);
  } catch (e) {
    try {
      return await fetchOnce(url);
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2 ?? e);
      return failed(url, msg.includes("timeout") ? "timeout" : msg.slice(0, 120));
    }
  }
}

/** Merge contact signals from an extra page into the homepage result. */
function mergeContact(home: SiteSignals, page: SiteSignals): SiteSignals {
  return {
    ...home,
    contactEmail: home.contactEmail || page.contactEmail,
    hasContactInfo: home.hasContactInfo || page.hasContactInfo,
    hasContactPage: home.hasContactPage || page.hasContactPage,
  };
}

/**
 * Scrape a website into quality signals. When the homepage yields no contact
 * email — the asset the cold-approach flow needs — fetch up to two same-origin
 * pages (/contact, /about) and merge their contact signals. Extra fetches are
 * best-effort: failures leave the homepage result untouched.
 */
export async function scrapeSite(url: string): Promise<SiteSignals> {
  let home = await fetchWithRetry(url);
  if (!home.ok || home.contactEmail) return home;

  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return home;
  }

  for (const path of ["/contact", "/about"]) {
    try {
      const page = await fetchOnce(origin + path);
      if (page.ok) home = mergeContact(home, page);
    } catch {
      /* ignore — best effort */
    }
    if (home.contactEmail) break;
  }
  return home;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/scraping/site.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/scraping/site.ts src/lib/scraping/site.test.ts
git commit -m "feat(scraping): crawl /contact and /about to capture missing email"
```

---

## Task 6: Lead model — demand columns, mapping, upsert defaults, rank sort

**Files:**
- Modify: `src/lib/types.ts` (Lead fields)
- Modify: `supabase/schema.sql`
- Modify: `src/lib/db/leads.ts`

- [ ] **Step 1: Add fields to the `Lead` interface**

In `src/lib/types.ts`, inside `interface Lead`, add after `engine: "ai" | "fallback";`:

```ts
  /** Google rating 0–5, or null when unknown. */
  rating: number | null;
  /** Number of reviews, or null when unknown. */
  review_count: number | null;
  /** Business-value score 0–100 (reviews × rating, baseline 50 when unknown). */
  value_score: number;
  /** Detected site builder / CMS, or null. */
  builder: string | null;
```

- [ ] **Step 2: Add the columns to the schema (with idempotent ALTERs)**

In `supabase/schema.sql`, inside the `create table if not exists leads (...)` block, add after the `engine` line (`engine text default 'fallback',`):

```sql
  rating real,
  review_count integer,
  value_score integer,
  builder text,
```

Then, immediately after the `create unique index ... idx_leads_website ...` line, add idempotent migrations for already-deployed databases:

```sql
-- New demand/value columns (idempotent for existing deployments).
alter table leads add column if not exists rating real;
alter table leads add column if not exists review_count integer;
alter table leads add column if not exists value_score integer;
alter table leads add column if not exists builder text;
```

- [ ] **Step 3: Map the new columns in `rowToLead` and the row interface**

In `src/lib/db/leads.ts`, add to `interface LeadRow` after `engine: string;`:

```ts
  rating: number | null;
  review_count: number | null;
  value_score: number | null;
  builder: string | null;
```

In `rowToLead`, change the returned object so `value_score` is never null (baseline 50). Update the return to add this line (after `meta: parseMeta(r.meta),`):

```ts
    value_score: r.value_score ?? 50,
```

(`rating`, `review_count`, `builder` already flow through via `...r`.)

- [ ] **Step 4: Make the new fields optional on `NewLead` and default them in `upsertLead`**

In `src/lib/db/leads.ts`, replace the `NewLead` type:

```ts
export type NewLead = Omit<
  Lead,
  "id" | "created_at" | "priority_locked" | "meta" | "rating" | "review_count" | "value_score" | "builder"
> & {
  meta?: LeadMeta | null;
  rating?: number | null;
  review_count?: number | null;
  value_score?: number;
  builder?: string | null;
};
```

In `upsertLead`, add to the `row` object (after `meta: lead.meta ? JSON.stringify(lead.meta) : null,`):

```ts
    rating: lead.rating ?? null,
    review_count: lead.review_count ?? null,
    value_score: lead.value_score ?? 50,
    builder: lead.builder ?? null,
```

In the same `upsertLead`, extend the `ON CONFLICT (website) DO UPDATE SET` list — add after `web_presence = excluded.web_presence, meta = excluded.meta`:

```sql
      , rating = excluded.rating, review_count = excluded.review_count,
      value_score = excluded.value_score, builder = excluded.builder
```

- [ ] **Step 5: Add the `rank` sort to `listLeads`**

In `src/lib/db/leads.ts`, in `interface LeadFilter`, change the `sort` type:

```ts
  sort?: "rank" | "score" | "recent" | "name";
```

In `listLeads`, replace the `order` assignment with:

```ts
  const order =
    filter.sort === "name"
      ? sql`name ASC`
      : filter.sort === "recent"
        ? sql`created_at DESC`
        : filter.sort === "score"
          ? sql`lead_score DESC`
          : sql`lead_score * COALESCE(value_score, 50) DESC`;
```

(The final branch — combined rank — is now the default when `sort` is unset or `"rank"`.)

- [ ] **Step 6: Verify the project type-checks**

Run: `npx tsc --noEmit`
Expected: no errors. (`manual.ts` and `instagram-lead.ts` keep compiling because the new `NewLead` fields are optional.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/types.ts supabase/schema.sql src/lib/db/leads.ts
git commit -m "feat(db): store rating/reviews/value_score/builder; add rank sort"
```

---

## Task 7: Thread demand & builder through the pipeline

**Files:**
- Modify: `src/lib/pipeline.ts`

- [ ] **Step 1: Swap discovery over to the source chain**

In `src/lib/pipeline.ts`, update imports: remove the `discoverViaDirectory` import line and add:

```ts
import { defaultSources, runSourceChain } from "@/lib/scraping/sources";
```

Replace the entire `discover` function (the `if (req.mode === "import")` block plus the Google-Maps/OSM try/catch, currently lines 91–133) with:

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

  return runSourceChain(defaultSources(), industry, location, {
    limit: req.limit,
    onLog: (message, level) => emit({ type: "log", message, level }),
  });
}
```

- [ ] **Step 2: Update `valueScore` import and the `store` signature**

In `src/lib/pipeline.ts`, change the scoring import:

```ts
import { priorityFromScore } from "@/lib/scoring";
```

to:

```ts
import { priorityFromScore, valueScore } from "@/lib/scoring";
```

Replace the `store` function's signature and `NewLead` body so demand/builder flow through. Replace the existing `store` (currently lines 218–250) with:

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
  builder: string | null = null
): Promise<Lead> {
  const rating = biz.rating ?? null;
  const reviewCount = biz.reviewCount ?? null;
  const lead: NewLead = {
    name: biz.name || website,
    website,
    phone: biz.phone || "",
    email: email || biz.email || "",
    address: biz.address || "",
    industry,
    location,
    source,
    design_score: a.design_score,
    seo_score: a.seo_score,
    conversion_score: a.conversion_score,
    lead_score: a.lead_score,
    priority: priorityFromScore(a.lead_score),
    status: "new",
    ai_summary: a.summary,
    issues: a.issues,
    opportunities: a.opportunities,
    engine: a.engine,
    web_presence: presence,
    rating,
    review_count: reviewCount,
    value_score: valueScore(rating, reviewCount, builder),
    builder,
  };
  return upsertLead(lead);
}
```

- [ ] **Step 3: Pass the detected builder from the scraped site into `store`**

In `src/lib/pipeline.ts`, in `processBusiness`, update the real-site branch (the final block that calls `store(biz, website, ...)`) to forward the builder:

```ts
  emit({ type: "log", message: `Scraping ${biz.name}…` });
  const signals: SiteSignals = await scrapeSite(biz.website);
  const analysis = await analyzeSite(signals).catch(() => analyzeWithRules(signals));
  const email = biz.email || signals.contactEmail || "";
  const website = canonicalUrl(biz.website) || biz.website;
  const lead = await store(
    biz,
    website,
    industry,
    location,
    biz.source,
    analysis,
    "site",
    email,
    signals.builder ?? null
  );
  return { lead, reachable: signals.ok };
```

(The no-website / social / directory `store` calls keep their existing arguments — `builder` defaults to `null`, and `biz.rating`/`biz.reviewCount` are read inside `store`, so Places demand data is retained even for no-site leads.)

- [ ] **Step 4: Verify type-check and full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all vitest suites PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pipeline.ts
git commit -m "feat(pipeline): discover via source chain; persist demand + builder"
```

---

## Task 8: Surface demand + builder in the UI

**Files:**
- Modify: `src/app/api/leads/route.ts` (default sort)
- Modify: `src/app/leads/page.tsx` (sort option)
- Modify: `src/components/lead-table.tsx` (rating column)
- Modify: `src/components/lead-drawer.tsx` (rating + builder)

- [ ] **Step 1: Default the API sort to `rank`**

In `src/app/api/leads/route.ts`, change:

```ts
    sort: (sp.get("sort") as LeadFilter["sort"]) || "score",
```

to:

```ts
    sort: (sp.get("sort") as LeadFilter["sort"]) || "rank",
```

- [ ] **Step 2: Add the `Rank` sort option and make it the default**

In `src/app/leads/page.tsx`, replace the `SORTS` array:

```ts
const SORTS = [
  { value: "rank", label: "Best leads" },
  { value: "score", label: "Score" },
  { value: "recent", label: "Recent" },
  { value: "name", label: "Name" },
];
```

and change the initial sort state:

```ts
  const [sort, setSort] = useState("rank");
```

- [ ] **Step 3: Add a rating/review column to the table**

In `src/components/lead-table.tsx`:

Add `fmt` to the utils import:

```ts
import { displayHost, fmt, cn } from "@/lib/utils";
```

Add a header cell after the Industry `<th>` (the one labelled "Industry"):

```tsx
            <th className="hidden px-3 py-2.5 font-medium sm:px-4 lg:table-cell">Demand</th>
```

Add the matching body cell after the Industry `<td>` (the `md:table-cell` industry cell), before the Lead-score cell:

```tsx
              <td className="hidden px-4 py-3 lg:table-cell">
                {lead.rating != null ? (
                  <span className="tnum whitespace-nowrap text-xs text-text-secondary">
                    {lead.rating.toFixed(1)} <span className="text-warning">★</span>
                    <span className="text-text-muted"> · {fmt(lead.review_count)}</span>
                  </span>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </td>
```

- [ ] **Step 4: Show rating + builder in the drawer overview**

In `src/components/lead-drawer.tsx`, inside `DrawerBody`'s Overview `<section>`, add a demand/builder line immediately after the `lead.ai_summary` paragraph block and before `<ContactRow lead={lead} />`:

```tsx
          {(lead.rating != null || lead.builder) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {lead.rating != null && (
                <span className="tnum inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-1 text-text-secondary">
                  <span className="text-warning">★</span> {lead.rating.toFixed(1)}
                  <span className="text-text-muted">· {fmt(lead.review_count)} reviews</span>
                </span>
              )}
              {lead.builder && <Pill>Built on {lead.builder}</Pill>}
            </div>
          )}
```

`fmt` and `Pill` are already imported in this file (`fmt` from `@/lib/utils`, `Pill` from `@/components/ui`).

- [ ] **Step 5: Verify the build compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/leads/route.ts src/app/leads/page.tsx src/components/lead-table.tsx src/components/lead-drawer.tsx
git commit -m "feat(ui): show demand (rating/reviews) + builder; default to Best leads sort"
```

---

## Task 9: Document the Places API key

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document the env var**

In `README.md`, in the "How discovery works" section, change item 1 and add an env note. Replace the numbered discovery list's first bullet so it reads:

```markdown
1. **Google Places API** (primary, opt-in) — set `GOOGLE_PLACES_API_KEY` to use
   the official API: structured website/phone/rating/review-count, works on the
   hosted site. Skipped automatically when the key is absent.
2. **Google Maps** (Playwright) — used when no Places key is set; scrapes
   businesses for `industry in location` locally.
3. **OpenStreetMap** (fallback) — used when the above return nothing.
4. **Import** — paste URLs (one per line) or a CSV (`name,website,phone,email`).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document GOOGLE_PLACES_API_KEY discovery source"
```

---

## Final verification

- [ ] Run the full suite: `npm test` — all PASS.
- [ ] Type-check: `npx tsc --noEmit` — clean.
- [ ] Manual smoke (optional, needs a key): set `GOOGLE_PLACES_API_KEY`, run a scan from the Scraper page, confirm leads arrive with ratings and sort "Best leads" first.
