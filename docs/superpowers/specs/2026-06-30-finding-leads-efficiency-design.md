# Finding Leads More Efficiently (Design)

**Date:** 2026-06-30
**Status:** Approved for planning

Sub-project 1 of 3 in the lead-system improvement effort. The other two
(Organizing leads, Cold-approach usefulness) are separate specs built afterward.

## Problem

Discovery is the weakest link. The only rich source — Google Maps via Playwright
— uses a brittle CSS selector (`a.hfpxzc`) and only runs locally; the hosted app
falls back to Nominatim, a geocoder with sparse business data. Scoring measures
only how *bad* a site is, so a dead 2-review business can outrank a busy
200-review one. Site scraping reads only the homepage, so contact emails on
`/contact` are missed and "no contact info" is reported falsely.

## Goals

- Add an **opt-in Google Places API** source as the reliable, hosted-capable
  primary, with graceful fallback to the existing free path.
- Capture **demand signals** (rating, review count) and rank leads by
  **business value × website weakness**, not weakness alone.
- Detect the site **builder/tech stack** (Wix, Squarespace, etc.) as a warm-lead
  qualifier.
- **Crawl a couple of internal pages** to capture the contact email the
  cold-approach flow depends on.
- Keep UI additions minimal — no new pages or controls beyond one table column
  and a few drawer fields.

## Non-goals

- No scheduled/recurring/background scans (explicitly out — avoids UI bloat).
- No Yelp or other paid providers in this sub-project (Places only).
- No change to outreach, notes/CRM fields, screenshots, or audit PDFs (later
  sub-projects).
- The free path keeps working with **no key required** — Places is purely additive.

## Approach (chosen): ordered source-adapter chain

Extract discovery from the inline `try/catch` blocks in `pipeline.ts` into a
small **ordered chain** of sources sharing one interface:

```ts
interface DiscoverySource {
  name: string;
  available(): boolean;          // e.g. Places only when key is set
  discover(industry, location, opts): Promise<DiscoveredBusiness[]>;
}
```

`discover()` runs available sources in priority order and returns the first
non-empty result:

**Places (if `GOOGLE_PLACES_API_KEY`) → Google Maps scraper → OpenStreetMap.**

Rejected alternatives:
- Inline another `if` in `pipeline.ts` — less code now, but tangles discovery
  while we're also adding scoring/crawl complexity; `pipeline.ts` already does a
  lot.
- Separate post-discovery enrichment call to Places Details for every business —
  doubles API calls and only helps when a key exists anyway.

## Components

### `src/lib/scraping/places.ts` (new)
`discoverViaPlaces(industry, location, opts): Promise<DiscoveredBusiness[]>`
- Places **Text Search** (`"<industry> in <location>"`) → for each result,
  **Place Details** for `website`, `phone`, `address`, `rating`,
  `userRatingCount`.
- Pure `fetch` with `AbortSignal.timeout`, mirroring `site.ts`/`lookup.ts`
  conventions. Respects `opts.limit` and `opts.onLog`.
- Reads `process.env.GOOGLE_PLACES_API_KEY`; `available()` is false when unset.
- `source: "google places"`. Maps missing fields to `""`/`null` — never invents.

### Source chain — `src/lib/scraping/sources.ts` (new) + `pipeline.ts`
- New module exposes the ordered source list and a `discover()` that tries each
  available source, logging which one ran and falling through on empty/error.
- `pipeline.ts`'s current `discover()` is replaced by a call into this module;
  the import-mode branch stays in `pipeline.ts`.

### Demand signals on the data model
- `DiscoveredBusiness` gains `rating: number | null` and
  `reviewCount: number | null`.
- `Lead` + `NewLead` gain `rating`, `review_count`, `value_score`, and `builder`.
- **Migration:** the app is **Postgres-only** (no active SQLite path —
  `better-sqlite3` is legacy). Add `rating REAL`, `review_count INTEGER`,
  `value_score INTEGER`, `builder TEXT` to the `leads` table in
  `supabase/schema.sql`, **plus idempotent `ALTER TABLE leads ADD COLUMN IF NOT
  EXISTS ...` statements** so already-deployed databases pick the columns up.
  New columns default to 0 / NULL so existing rows are unaffected.
- `value_score` is **stored** (computed once at store time). `rank_score` is
  **not** a column — it's computed at sort time from the two stored scores (see
  below), so it can never drift out of sync.

### Two-axis scoring — `src/lib/scoring.ts`
- `lead_score` (website weakness) keeps its current meaning and computation.
- New `valueScore(rating, reviewCount, builder): number` (0–100): review volume
  log-scaled (e.g. `min(100, round(log10(reviewCount+1) * 33))`) blended with
  rating, plus a small boost when `builder` is a DIY platform. When review data
  is absent (free path), returns a **neutral baseline (50)** so ranking degrades
  to weakness-only.
- `rankScore(leadScore, valueScore)` (product of the two) exists in `scoring.ts`
  for clarity/tests, but **list sorting computes it inline in SQL ORDER BY**
  (`lead_score * COALESCE(value_score, 50) DESC`) — no stored `rank_score`
  column.
- `priority` band stays derived from `lead_score` (unchanged "opportunity"
  meaning). Demand shows as its own indicator, not folded into priority.

### Builder/tech-stack detection — `src/lib/scraping/parse.ts`
- Pure `detectBuilder(html, $): string | null` — checks `<meta name="generator">`
  and known script/asset hosts (WordPress, Wix, Squarespace, GoDaddy/Website
  Builder, Webflow, Shopify). Returns a label or null.
- `SiteSignals` gains `builder: string | null`. Stays a pure, unit-testable
  function (no network).

### Deeper crawl — `src/lib/scraping/site.ts`
- After the homepage scrape, **if no contact email was captured**, fetch up to
  **2 same-origin pages** (`/contact`, `/about`) and merge their signals
  (email, contact flags) into the homepage result.
  - Email is the prize for cold approach, so a missing **email** (not just any
    contact info) triggers the extra fetches.
  - Reuses the existing `fetchOnce` retry/timeout; capped at 2 extra requests;
    same-origin only; failures are swallowed (homepage result still returned).
- `parse.ts` stays pure; `site.ts` owns the small crawl + merge.

## UI (minimal)

- **Leads table** (`lead-table.tsx`): one compact column rendering rating +
  review count (e.g. `4.7 ★ · 182`), blank when unknown. Default sort switches
  from `lead_score` to `rank_score`.
- **Lead drawer** (`lead-drawer.tsx`): rating/reviews and detected `builder`
  added to the existing Overview block. No new sections.
- `listLeads` sort: add a `rank` sort option and make it the default; existing
  `score`/`recent`/`name` options remain.

## Error / edge handling

- No `GOOGLE_PLACES_API_KEY` → Places source reports unavailable; chain proceeds
  to the scraper/OSM exactly as today.
- Places HTTP error/timeout/quota → log a warning, fall through to the next
  source (never aborts the scan).
- Missing rating/reviews → `value_score` baseline; UI column blank.
- Deeper-crawl page fetch fails → ignored; homepage signals stand.

## Testing (vitest, matching existing style)

- `places.ts`: mock `fetch` for Text Search + Details → correct
  `DiscoveredBusiness[]`; missing fields map to `""`/`null`; `available()`
  false without a key.
- `scoring.ts`: `valueScore` monotonic in reviews/rating, baseline when data
  absent, DIY-builder boost; `rankScore` ordering (busy-bad-site > dead-bad-site
  > busy-good-site).
- `parse.test.ts`: `detectBuilder` for WordPress/Wix/Squarespace/Shopify/none.
- `site.ts`: when homepage has no email, `/contact` is fetched and its email
  merged; when homepage has an email, no extra fetch; same-origin enforced.
- Source chain: Places used when available; falls through on empty/throw.
