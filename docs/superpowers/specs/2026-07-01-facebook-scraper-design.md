# Facebook Scraper — Design

**Date:** 2026-07-01
**Status:** Approved (pre-implementation)

## Goal

Add Facebook as a **business-discovery source** for the scanner. A business whose
only web presence is a Facebook page is exactly the kind of lead this app hunts
for, so surfacing FB-only businesses adds high-value, no-website leads to the
pipeline. For businesses that already have a website, capture and link it so the
user can immediately tell "no site → build" from "has a site → redesign".

## Decisions (from brainstorming)

1. **Role:** discovery source (find businesses by industry + location), *not*
   single-page enrichment.
2. **Method:** search-engine-mediated. Facebook blocks unauthenticated search
   behind a login wall, so we do **not** scrape Facebook search directly and we
   do **not** use stored FB account credentials (ToS + ban risk). Instead we use
   Google to find public FB business-page URLs, then read each page.
3. **Search engine:** Google, driven by Playwright (see below).
4. **Integration:** additive and **opt-in** via a checkbox on the scanner. When
   on, Facebook runs alongside the normal source chain and results are merged +
   deduped. Off by default so scans don't pay the extra latency / rate-limit
   cost unless asked.
5. **Website detection (hard requirement):** for every Facebook lead, detect
   whether the business has a real website and, if so, store + **link** it. All
   Facebook leads still land on `/social`.
6. **/social filter (hard requirement):** the `/social` page gains a source
   filter — **All · Instagram · Facebook**.

## Search engine choice: Google via Playwright

Google blocks plain-fetch scraping, but discovery mode already spins up a real
browser locally for Google Maps (`src/lib/scraping/google-maps.ts`) and is
gated local-only. The Facebook source reuses that browser:

- Navigate to `https://www.google.com/search?q=<industry> <location> site:facebook.com&hl=en`.
- Reuse the consent-dismiss pattern from `google-maps.ts` (`dismissConsent`).
- Extract organic result anchors, decode Google's `/url?q=<encoded>&…` wrapper
  to the real URL.
- Filter to real `facebook.com/<page>` URLs; then reuse the same browser context
  to open each page (like `google-maps.ts` opens each place).

Rejected: DuckDuckGo/Bing fetch (user chose Google); paid SERP API (costs money
+ new key + billing, against the app's key-free-with-fallback design).

## Architecture

### New module: `src/lib/scraping/facebook.ts`

Public entry point matches the existing `DiscoverySource` contract used by
`directory.ts` and `google-maps.ts`:

```ts
discoverViaFacebook(
  industry: string,
  location: string,
  opts: DiscoverOptions,   // { limit?, onLog? }
): Promise<DiscoveredBusiness[]>
```

Orchestration (Playwright, local-only): launch/reuse a Chromium browser →
Google search → dismiss consent → collect + decode result URLs → filter/dedupe
to FB page URLs → cap to `opts.limit` → open each FB page → extract page data →
build `DiscoveredBusiness`. Fails **soft**: returns `[]` on block/empty and logs
via `opts.onLog`; never throws the scan. Per-page failures skip that one page
(like `google-maps.ts` per-place resilience).

Pure, individually testable helpers (no network — like `instagram.ts`):

- `buildSearchQuery(industry, location)` → e.g. `"roofing Montreal QC site:facebook.com"`
- `decodeGoogleUrl(href)` → real URL from a Google `/url?q=…` result href.
- `parseSearchResults(html)` → `string[]` decoded result URLs (parsed with Cheerio,
  already a dependency).
- `isBusinessPageUrl(url)` → `boolean` — keep real page URLs; reject `/groups/`,
  `/events/`, `/watch/`, `/photo`, `/story.php`, `profile.php`, `/login`,
  `/sharer`, etc. Dedupe by page slug.
- `extractWebsiteFromHtml(html)` → `string | null` — the business's real website:
  decode `l.facebook.com/l.php?u=<encoded>` outbound links and/or the page Intro's
  website field; ignore internal facebook.com links. Best-effort.
- `extractPageFromHtml(html, pageUrl)` → `DiscoveredBusiness` — `og:title` (name),
  category, best-effort email/phone (same regex approach as
  `extractContactFromBio`), `extractWebsiteFromHtml` for the real site;
  `source: "facebook"`, `website: <FB page URL>`, and a `facebook` metadata block
  (below).

### `website` field + metadata (mirrors the Instagram pattern)

Instagram stores the business's real site in `meta.instagram.externalUrl` and
renders it as a separate link in the drawer (`lead-drawer.tsx:270`), while the
lead's `website` field stays the social URL and the lead lives on `/social`.
Facebook does the same:

- `website` = the **Facebook page URL** → routes through the
  `presence === "social"` branch in `processBusiness` (`src/lib/pipeline.ts:135`)
  and keeps the lead on `/social` (satisfies the "FB leads go to /social" rule).
  `facebook.com` is already in `SOCIAL_HOSTS` (`src/lib/web-presence.ts:9`).
- The **real website** (or `null`) is stored in `meta.facebook.website`.
- `LeadMeta` (`src/lib/types.ts:82`) gains `facebook?: FacebookMeta` where
  `FacebookMeta = { pageUrl: string; category: string; website: string | null }`.
- `DiscoveredBusiness` (`src/lib/types.ts:20`) gains an optional `facebook?:
  FacebookMeta` field to carry this through the pipeline into `store()`.

### Scoring (honest split)

A dedicated Facebook analysis in `processBusiness`, chosen by whether
`biz.facebook.website` is set:

- **No website found** → top opportunity (~85), same framing as today's
  social-only path (`noRealSiteAnalysis`): "runs on a Facebook page with no real
  website — strong new-build candidate."
- **Website found** → lower score (~55) with honest framing: "already has a
  website (<url>) — redesign / SEO angle, not a from-scratch build." Issues /
  opportunities reflect that they already own a site.

Website detection is best-effort: if Facebook hides the link behind its login
gate we can't see it and the lead reads as "no website." Surfaced as best-effort,
not asserted as certain.

### Lead drawer — "Facebook page" card

Add a card to `DrawerBody` (`src/components/lead-drawer.tsx`) mirroring the
existing Instagram card, rendered when `lead.meta?.facebook` is present:

- Page name + category, "Open on Facebook" button (links `lead.website`).
- **Website line**: `meta.facebook.website` rendered as a clickable link when
  present, or a clear "No website — prime new-build lead" when `null`.

### Wiring the scan (additive, opt-in)

- `ScanRequest` (`src/lib/pipeline.ts:20`) gains `facebook?: boolean`.
- `discover()` (`src/lib/pipeline.ts:91`): run `runSourceChain(defaultSources(), …)`
  as today; if `req.facebook`, also call `discoverViaFacebook(…)` and concatenate
  both lists. Existing `dedupeBusinesses` (`src/lib/pipeline.ts:259`) collapses
  overlaps (canonical URL → phone → name-slug).
- `store()` (`src/lib/pipeline.ts:200`) accepts optional `meta` and writes it, so
  the social branch can persist `meta: { facebook: biz.facebook }`.
- Scanner UI (`src/app/scraper/page.tsx`): an "Also search Facebook" checkbox in
  the discover panel; include `facebook` in the discover request body. It sits
  inside discover mode, so it inherits the existing local-only gating
  (`scraperEnabled` / `NEXT_PUBLIC_SCRAPER_ENABLED`).

### Source filter on `/social`

Leads carry a `source` text field: Instagram → `source: "instagram"`
(`src/lib/instagram-lead.ts:68`), Facebook → `source: "facebook"`.

- **DB** (`src/lib/db/leads.ts`): add `source?: string` to `LeadFilter`; in
  `listLeads`, `if (filter.source) conds.push(sql\`source = ${filter.source}\`)`.
- **API** (`src/app/api/leads/route.ts`): add
  `source: sp.get("source") || undefined`.
- **Client** (`src/lib/api.ts`): add `source?: string` to `LeadQuery` (the
  generic param builder already serializes it).
- **UI** (`src/app/social/page.tsx`): a segmented control — **All · Instagram ·
  Facebook** — backed by a `source` state (`""` / `"instagram"` / `"facebook"`),
  passed into the existing
  `fetchLeads({ presence: "no_site", sort, search, source })` call. "All" keeps
  today's behavior (every no-site lead).

## Data flow

```
Scanner (discover, "Also search Facebook" ✓)
  → POST /api/scan { mode:"discover", industry, location, limit, facebook:true }
    → runScan → discover():
        runSourceChain(Places → Maps → OSM)      ─┐
        discoverViaFacebook(industry, location)   ┘→ concat → dedupeBusinesses
    → processBusiness (FB URL ⇒ presence "social"):
        biz.facebook.website == null ⇒ top-opportunity (~85)
        biz.facebook.website != null ⇒ has-site analysis (~55)
    → store(..., meta:{ facebook:{ pageUrl, category, website } })
      (source:"facebook", web_presence:"social")
  → lead appears on /social; filter to Facebook via source="facebook"
  → drawer "Facebook page" card shows website (linked) or "No website"
```

## Error handling

- Google search blocked/empty → return `[]`, log a warning, scan continues with
  whatever the other sources found.
- A single FB page fetch failing → skip that page, keep the rest.
- All navigation uses timeouts (matching existing scrapers).
- `discoverViaFacebook` never throws into the scan.

## Testing

Pure helpers with fixture HTML, no network — following `instagram.test.ts` /
`osm.test.ts`:

- `src/lib/scraping/facebook.test.ts`:
  - `buildSearchQuery` — composes the `site:facebook.com` query.
  - `decodeGoogleUrl` — `/url?q=…` wrapper → real URL.
  - `parseSearchResults` — Google results fixture → decoded `facebook.com/<page>` URLs.
  - `isBusinessPageUrl` — keeps real pages; rejects groups/events/profile.php/login.
  - `extractWebsiteFromHtml` — decodes `l.php?u=` / Intro link; returns `null` when
    only internal FB links exist.
  - `extractPageFromHtml` — OG fixture → name, category, website, best-effort
    email/phone.
- Source filter: verify `listLeads` composes the `source = …` condition. If the
  DB layer has no unit-test harness (no live connection in tests), cover
  source-filtering at the helper level instead — confirm during plan-writing.

## Out of scope for v1 (documented)

- Facebook as a single-page enrichment tool (analogue of the Instagram "Add
  lead" flow).
- Scraping/analyzing the detected external website's content (design/SEO scoring
  of the real site) — we detect + link it, but don't crawl it.
- Running Facebook discovery on hosted Vercel — search engines block datacenter
  IPs, so it stays local like Google Maps discovery.

## Affected files

- **New:** `src/lib/scraping/facebook.ts`, `src/lib/scraping/facebook.test.ts`
- **Edit:**
  - `src/lib/types.ts` (`FacebookMeta`, `LeadMeta.facebook`, `DiscoveredBusiness.facebook`)
  - `src/lib/pipeline.ts` (`ScanRequest.facebook`, discover merge, FB analysis, `store` meta)
  - `src/app/scraper/page.tsx` (checkbox + body)
  - `src/components/lead-drawer.tsx` ("Facebook page" card)
  - `src/lib/db/leads.ts` (source filter)
  - `src/app/api/leads/route.ts` (source param)
  - `src/lib/api.ts` (`LeadQuery.source`)
  - `src/app/social/page.tsx` (source segmented control)
