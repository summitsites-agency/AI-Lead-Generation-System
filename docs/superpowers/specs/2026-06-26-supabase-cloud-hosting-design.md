# Cloud Hosting — Supabase Postgres + Vercel

**Date:** 2026-06-26
**Status:** Approved design, pending spec review

## Goal

Make the AI Lead Generation System usable from a phone (or any device) as a
live website, with the laptop off — "as if I'm using a website." Data must be
shared and persistent: a lead added or edited on the phone is visible on the
laptop later, and vice versa.

## Decisions (locked)

- **Host:** Vercel (the app is Next.js 16 — its native platform).
- **Database:** Supabase Postgres, project **`jpywqhhzxivdtkynqaen`**.
  - This project is NOT linked to the connected Supabase MCP tools, so schema
    and data migration are done manually (SQL run in the Supabase dashboard, or
    a local script using the connection string) rather than via tooling.
- **DB access style:** Direct Postgres with raw SQL via the `postgres`
  (postgres.js) driver. Keep the existing SQL; port SQLite syntax → Postgres.
- **Auth:** Single shared password (env var `APP_PASSWORD`), signed cookie,
  enforced by Next.js middleware. No per-user accounts.
- **Scraper:** Google Maps / Playwright scanning stays a LOCAL feature (runs on
  the laptop). It is disabled/hidden on the hosted site. Local scans write to
  the same Supabase DB, so results appear on the phone.

## Architecture

```
   Phone ─────┐
              ├──>  Vercel (hosted Next.js)  ──┐
   Laptop ────┘                                ├──>  Supabase Postgres
                                               │      (single source of truth)
   Laptop running local scans (Playwright) ────┘
   (only when the laptop is on)
```

Both the hosted site and any locally-run instance point at the **same** Supabase
Postgres database, so all reads/writes are shared and durable.

## Components & changes

### 1. Database connection — `src/lib/db/index.ts`
- Replace `better-sqlite3` with a `postgres` (postgres.js) connection pool.
- Read connection string from `DATABASE_URL` (Supabase **pooled / Transaction**
  connection string — required for serverless on Vercel).
- Cache the client on `globalThis` (same pattern already used) to survive HMR
  and reuse across warm function invocations.
- Move schema creation into an idempotent migration run once at startup (or a
  standalone migration script — see Schema section).
- The exported accessor becomes async-friendly. `getDb()` returns the `sql`
  client; all query helpers become `async`.

### 2. Schema port (SQLite → Postgres)
Port the `CREATE TABLE` statements currently in `index.ts`:
- `INTEGER PRIMARY KEY AUTOINCREMENT` → `bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY`
- `created_at TEXT DEFAULT (datetime('now'))` → `created_at timestamptz DEFAULT now()`
- `INTEGER DEFAULT 0` score/flag columns → `integer DEFAULT 0`
  (keep `sent` as integer 0/1 to minimize app changes)
- Drop `PRAGMA journal_mode` / `PRAGMA foreign_keys` (Postgres enforces FKs
  natively; WAL is not applicable).
- Indexes (`idx_leads_website` unique, priority, status, web_presence,
  outreach lead) and `ON DELETE CASCADE` carry over with the same syntax.
- Replace the `PRAGMA table_info(leads)` migration check (for `web_presence`)
  with `ADD COLUMN IF NOT EXISTS web_presence text NOT NULL DEFAULT 'site'` plus
  the existing backfill `UPDATE`.
- Tables: `leads`, `outreach`, `scan_jobs`, `settings` (unchanged shape).

### 3. Query port — `src/lib/db/*.ts`
Convert each file to async and adjust dialect:
- `src/lib/db/settings.ts` — `INSERT ... ON CONFLICT(key) DO UPDATE` works in
  Postgres; convert `?` params and `.get()`/`.run()` to `await sql\`...\``.
- `src/lib/db/leads.ts` — convert dynamic `WHERE`/`ORDER BY` builder and the
  stats aggregation queries; `COUNT(*) c`, `AVG(...)`, `GROUP BY`, `BETWEEN`,
  `LIKE` all carry over. `?` → Postgres params.
- `src/lib/db/outreach.ts` — `DELETE`, `INSERT ... RETURNING *`, `UPDATE` →
  async; `sent ? 1 : 0` retained.
- `src/lib/db/jobs.ts` — replace `info.lastInsertRowid` with
  `INSERT ... RETURNING id`; convert the `@id` named-param `UPDATE` and the
  `LIMIT ?` query.

### 4. Propagate async — callers
- API routes under `src/app/api/**` and `src/lib/pipeline.ts` must `await` the
  now-async DB helpers. Mechanical edit at each call site.

### 5. Auth — new
- `APP_PASSWORD` env var holds the shared password.
- `/login` page: simple form → POST to `src/app/api/login/route.ts`, compares to
  `APP_PASSWORD`, sets a signed httpOnly cookie on success.
- `middleware.ts`: blocks all routes except `/login`, the login API, and static
  assets, redirecting unauthenticated requests to `/login`.
- Logout clears the cookie.

### 6. Scraper gating (mode-specific)
Refinement discovered during implementation: only **Google Maps discovery** uses
Playwright. Single-site scraping (`scrapeSite`) and the OpenStreetMap fallback
use plain `fetch`, so the **import / manual "Add lead"** path works on Vercel.
Therefore the gate is per-mode, not a blanket off-switch — this is what lets you
add leads from your phone.
- Env flag `NEXT_PUBLIC_SCRAPER_ENABLED` (set `true` locally, unset on Vercel).
  Readable by both the client page and the server route.
- `src/app/scraper/page.tsx`: when disabled, show a "discovery runs locally"
  notice and disable the discovery Start button. The Import / CSV tab stays on.
- `src/app/api/scan/route.ts`: reject only `mode === "discover"` when disabled,
  returning a friendly ndjson message. `mode === "import"` always proceeds.
- `src/lib/pipeline.ts`: `discoverViaGoogleMaps` is imported dynamically inside
  `discover()`, so the Playwright dependency never loads on the import path.
- `maxDuration` lowered from 600 → 300 (Vercel's cap).

### 7. Existing data migration
- One-time Node script: read rows from local `data/leadgen.db` (via
  `better-sqlite3`, kept as a devDependency) and `INSERT` them into Supabase
  using the connection string. Covers `leads`, `outreach`, `scan_jobs`,
  `settings`. Run once before/just after first deploy.

### 8. Repo / deployment
- The project is currently NOT a git repo → `git init`, commit, push to GitHub.
- Confirm `.gitignore` excludes `.env*`, `/data`, `/.next` (it already does).
- Import the repo in Vercel; set env vars (below); deploy → public URL.

## Environment variables (set in Vercel)

| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Supabase pooled Postgres connection string (secret) |
| `APP_PASSWORD` | Shared login password (secret) |
| `AI_PROVIDER` | groq \| gemini \| openrouter |
| `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | whichever providers are used |
| `GROQ_MODEL` / `GEMINI_MODEL` / `OPENROUTER_MODEL` | optional model overrides |
| `NEXT_PUBLIC_SCRAPER_ENABLED` | `true` locally; unset on Vercel |

Local `.env` keeps the same values plus `NEXT_PUBLIC_SCRAPER_ENABLED=true` and `HEADLESS`.

## Testing

- Keep existing vitest tests (scoring, parse, csv, web-presence, fallback) — they
  don't touch the DB and should stay green.
- Add a smoke test for the new Postgres DB adapter (connect, run migrations,
  insert/read/update a lead) against a disposable Postgres target so it never
  touches production data.
- Manual verification: deploy, log in from phone, add a lead, confirm it appears
  on the laptop (and vice versa); confirm Scan is disabled on the hosted site and
  works locally writing to the same DB.

## Risks / open items

- **Connection string needed:** the deploy step is blocked until the pooled
  Postgres connection string for `jpywqhhzxivdtkynqaen` is provided.
- **Project not tool-linked:** schema + data migration are manual for this
  project (no MCP automation).
- **Serverless pooling:** must use the Transaction-mode pooled connection
  string, not the direct connection, or Vercel functions can exhaust connections.
- **Playwright on Vercel:** the `playwright` dependency is heavy; it stays
  unbundled (`serverExternalPackages`) and the scan route is gated so it never
  runs on Vercel.

## Out of scope (YAGNI)

- Per-user accounts / multi-tenant auth.
- Running the scraper in the cloud (separate always-on worker) — explicitly not
  needed; scans run locally.
- Switching the data layer to `supabase-js` / RLS.
- Migrating away from raw SQL.
