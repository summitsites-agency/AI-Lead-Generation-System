# Find by Company Name — Lead Lookup (Design)

**Date:** 2026-06-27
**Status:** Approved for planning

## Problem

Some leads have no website and no social media, so the discovery pipeline
(Google Maps / site scraping) can't find or score them. The user wants to add
such a lead by typing **just a company name**, have the AI fill in whatever can
be found, and prompt the user to complete the rest.

## Goals

- Add a no-website lead starting from a company name + city.
- Pull whatever real contact data exists from a browser-free source.
- Never fabricate phone/email/address — only format real data and flag gaps.
- Save through the existing lead pipeline so the new lead is indistinguishable
  from scanned leads (filters, stats, scoring, web-presence all work).

## Non-goals

- No Playwright/Chromium (Google Maps) — must run on the hosted site.
- No paid data providers.
- No bulk lookup — one company at a time.

## Approach (chosen)

**Two-step "Find & confirm" (hybrid research + interview):**

1. User submits **company name + city** (both required; city narrows the
   otherwise-noisy name search).
2. Backend queries **Nominatim (OpenStreetMap)** — pure HTTP, no browser — and
   returns candidate matches.
3. UI shows a **picker** of candidates (name + address + any phone/site), plus a
   **"None of these — enter manually"** option.
4. On selection, the AI **normalizes** the chosen candidate into a draft lead and
   marks which fields are missing. (Manual option → empty draft, all gaps.)
5. User edits/confirms the draft form; **Save** creates the lead.

Rejected alternatives:
- One-shot auto-add (no confirm) — user can't catch wrong match / empty fields.
- Pure AI interview (no lookup) — throws away free real OSM data.
- Gemini search grounding — provider-specific, requires AI-client rewrite.

## Components

### `src/lib/scraping/lookup.ts`
`lookupByName(name, city, limit = 10): Promise<DiscoveredBusiness[]>`
- Queries Nominatim with the name + city, `format=json`, `extratags`,
  `namedetails`, identifying User-Agent (OSM policy: ≤1 req/s, one request per
  search).
- Maps OSM tags → `DiscoveredBusiness` (name, website, phone, email, address,
  source `"openstreetmap"`).
- **Refactor:** extract the OSM-result → `DiscoveredBusiness` mapping currently
  inline in `directory.ts` into a shared helper both files call. No behavior
  change to `directory.ts`.

### `src/lib/ai/draft-lead.ts`
`draftLeadFromCandidate(candidate): Promise<{ draft, missing: string[] }>`
- AI tidies industry label and address formatting from the candidate's real
  fields. **Must not invent** phone/email/address — prompt is explicit, and the
  output is validated to only keep values that were present in the input (AI may
  reformat but not add new contact facts).
- `missing` = list of empty/blank fields among {phone, email, address, industry}.
- **Fallback** (no AI key / AI error, mirroring `analyze.ts` → `fallback.ts`):
  pass the candidate through unchanged and compute `missing` directly.

### `src/app/api/leads/lookup/route.ts`
- `runtime = "nodejs"`.
- `POST { name, city }` → `{ candidates: DiscoveredBusiness[] }`.
  - 400 if name or city missing/blank.
  - Nominatim error/timeout → 502 with a message; UI offers manual entry.
  - Empty results → `{ candidates: [] }`; UI drops to manual entry.

### Saving the confirmed draft
- Today there is **no single-lead form-save endpoint**: the "Add your own lead"
  flow runs through the import pipeline (`parseImport` → `processBusiness` →
  `store` → `upsertLead`). For this feature the confirmed draft is already
  structured, so add a **save action** that builds a `NewLead` and calls
  `upsertLead` directly. Extract the no-website analysis + `store` shaping from
  `pipeline.ts` into a small shared helper so the lookup save and the pipeline
  produce identical rows.
- The save action lives in the lookup route (`POST { confirm: NewLead-ish }` or a
  sibling `route.ts`) — finalize during planning.
- **Website key rule:** classify the confirmed website with
  `classifyWebPresence`:
  - real site / social / directory → use the (canonicalized) URL as the key,
    exactly like the pipeline.
  - presence `"none"` → synthesize `nowebsite://${slug(name)}-${slug(city)}`.
- `source = "manual-lookup"`.
- Scoring uses the rules path (`analyzeWithRules` / the no-website fixed analysis
  used in `pipeline.ts`), since there is no site to scrape — a no-website
  business correctly scores as a high-value lead.

### UI
- New panel/component on the scraper page driving the 3 states:
  **search → pick (candidate list) → confirm (pre-filled form, gaps highlighted)**.
- Reuses existing lead-form fields and styling.

## Data & dedupe

- Every lead already has a unique, non-empty `website` (the pipeline assigns
  `nowebsite://<slug>` for no-site leads — see `pipeline.ts`). The unique index
  `idx_leads_website` is untouched; **no schema migration**.
- No-site lookup leads use `nowebsite://${slug(name)}-${slug(city)}` so same-name
  businesses in different cities stay separate, and re-looking-up the same
  company+city updates the existing row via `ON CONFLICT (website)`.
- **Accepted tradeoff:** a no-site lead added via lookup
  (`nowebsite://acme-plumbing-denver`) and the same business added via the
  pipeline (`nowebsite://acme-plumbing`) would be two rows. Acceptable because
  the lookup flow exists precisely for businesses the scanner can't reach.

## Error / edge handling

- Missing name or city → 400, inline form validation.
- Nominatim down/timeout → error message + manual-entry fallback.
- Zero matches → manual-entry fallback.
- AI unavailable → fallback passthrough (no AI required for the feature to work).

## Testing

- `lookup.ts`: mock Nominatim JSON → candidates for 0 / 1 / many results; shared
  mapping helper still produces identical output for `directory.ts`.
- `draft-lead.ts`: no-AI-key fallback returns raw candidate; `missing` computed
  correctly; AI output cannot introduce contact facts absent from the input.
- Website-key rule: presence `"none"` → `nowebsite://<name>-<city>`; real URL
  preserved for social/directory.
- web-presence stays `"none"` for a blank website draft.
