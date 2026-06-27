# Summit Sites — AI Lead Generation System

AI-powered lead intelligence for web agencies: find local businesses, scrape and
analyze their websites, score them by opportunity, and generate outreach — all in
one dark-SaaS dashboard.

Built as a single **Next.js 16** app (React UI + API routes), with **Playwright**
for Google Maps scraping, **better-sqlite3** for storage, and a swappable AI layer.

## ⚠️ Location matters (do not put this in OneDrive)

This project must live **outside** a OneDrive-synced folder. OneDrive continuously
syncs Next's `.next` build output, which corrupts chunks and makes the dev server
take **30–90s per page**. It currently lives at:

```
C:\Users\sport\Desktop\AI-Lead-Generation-System   (non-synced — fast)
```

## Run it

```bash
npm install
npx playwright install chromium   # one-time, browser for Google Maps scraping
npm run dev                       # http://localhost:3000
```

Then open the **Scraper** page, enter an industry + location (e.g. "roofing",
"Montreal"), and hit **Start scan**. Leads stream in live and land in the
Dashboard / Leads / Campaigns views.

## AI providers (optional)

The system runs fully **without any API key** using a deterministic rule-based
scoring + templated outreach engine. Add a key to enable richer LLM analysis &
outreach. Copy `.env.example` → `.env` and fill in any of:

| Provider   | Env var              | Notes                              |
| ---------- | -------------------- | ---------------------------------- |
| Groq       | `GROQ_API_KEY`       | Recommended — fast, free tier      |
| Gemini     | `GEMINI_API_KEY`     | Google AI Studio free tier         |
| OpenRouter | `OPENROUTER_API_KEY` | Free community models, good backup |

Set `AI_PROVIDER` to pick the default, or switch live on the **Settings** page.

## How discovery works

1. **Google Maps** (primary) — Playwright scrapes businesses for `industry in location`,
   pulling name, website, phone and address.
2. **OpenStreetMap** (fallback) — used automatically if Maps returns nothing.
3. **Import** — paste URLs (one per line) or a CSV (`name,website,phone,email`).

Businesses with no website — or only a Facebook/Instagram page — are flagged as
**high-opportunity** new-build leads.

## Scripts

```bash
npm run dev     # dev server (Turbopack)
npm run build   # production build
npm start       # serve production build
npm test        # vitest (scoring, fallback, parsing, CSV import)
```

## Architecture

```
src/
  app/                 dashboard, leads, scraper, campaigns, analytics, settings
  app/api/             scan (streaming), leads, outreach, stats, settings
  components/          app shell, lead table, lead drawer, KPI cards, UI primitives
  lib/
    scraping/          google-maps · directory (OSM) · site · parse · csv
    ai/                client (groq|gemini|openrouter) · analyze · outreach · fallback · config
    db/                better-sqlite3: leads · outreach · jobs · settings
    scoring.ts         lead-score → HIGH/MEDIUM/LOW
    pipeline.ts        discover → scrape → analyze → score → store (live events)
```

Data is stored in a local SQLite file at `data/leadgen.db` (gitignored).
