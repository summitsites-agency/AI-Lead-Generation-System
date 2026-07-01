# Mobile-First UI/UX Overhaul — Design

**Date:** 2026-07-01
**Status:** Approved
**Scope:** Front-end only (`src/app/**`, `src/components/**`, `src/app/globals.css`, `src/app/layout.tsx`)

## Goal

Make the "Summit Sites — Lead Intelligence" app comfortable to use primarily on a phone. Keep the existing dark visual identity, blue accent, and desktop layout unchanged. Re-engineer everything below the `md` breakpoint for thumb-first use.

## Constraints & guardrails (YAGNI)

- **Keep the visual identity** — no rebrand, no new color system, no typography overhaul.
- **Desktop is untouched** except where a shared component changes; verify desktop still looks/behaves as before.
- **No new features, no data/model/API changes, no PWA/offline.**
- Existing `vitest` suite covers `src/lib` logic only (not UI) and must stay green. `npm run build` / typecheck must pass.

## Tailwind breakpoint convention

Mobile = the default (unprefixed) styles. `sm:` (~640px) and `md:` (~768px) restore/adjust for larger screens. Desktop sidebar and table appear at `md+`. "Mobile" below means "< md" unless stated.

---

## 0. Global foundations

These touch every screen and land first.

### 0.1 Viewport + safe areas
- Add a Next `viewport` export in `src/app/layout.tsx`:
  - `width=device-width, initialScale=1, viewportFit: "cover"`
  - `themeColor` matching the app background for dark and light (via `media` entries): dark `#0b0f17`, light `#f6f7f9`.
- Provide safe-area padding so no content hides under the notch/home indicator. Add utility classes in `globals.css`:
  - `.pb-safe` → `padding-bottom: env(safe-area-inset-bottom)`
  - `.pt-safe` → `padding-top: env(safe-area-inset-top)`
  - Bottom tab bar and bottom sheets consume these.

### 0.2 Kill iOS input zoom
- Every text input / select / textarea uses **16px font on mobile**, dropping to 14px at `sm+`. Implemented via a shared field class (see 4.3), not per-input edits.
- Rationale: iOS Safari auto-zooms when a focused field's font-size is < 16px.

### 0.3 Touch ergonomics
- In `globals.css` base layer: `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` on interactive elements (buttons, links, `[role="button"]`).
- **44px minimum** hit target on all primary interactive controls on mobile.
- Replace hover-only affordances with always-visible, tappable equivalents:
  - Lead table/card delete (was hover-revealed background) → always-visible control.
  - Website `ExternalLink` icon (`opacity-0 group-hover:opacity-100`) → always visible on mobile.

---

## 1. App shell & navigation (`src/components/app-shell.tsx`)

### Desktop (`md+`) — unchanged
Keep the static sidebar, collapse toggle, and slim header exactly as today.

### Mobile (< md) — bottom tab bar
- Remove the hamburger drawer path on mobile (redundant once tabs exist). The mobile slide-in `<aside>` drawer and its backdrop/`mobileOpen` state are no longer needed for mobile nav.
- Add a fixed **bottom tab bar** (hidden at `md+`):
  - Slots: **Dashboard · Leads · Scraper · Campaigns · More**
  - Each tab: icon + short label, active state uses `text-primary` + subtle indicator; inactive uses `text-text-secondary`.
  - Height ~56px + `.pb-safe`; `bg-surface` with top border; `fixed inset-x-0 bottom-0 z-40`.
- **More** opens a bottom sheet (shared `BottomSheet`, see 3.2) listing overflow destinations: **Social Leads, Analytics, Settings**, plus the **theme toggle**. Active route highlighted.
- Top header on mobile: keep the page title (left) and theme toggle (right); drop the hamburger button.
- Main content gets bottom padding on mobile so it clears the tab bar: `pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0` applied at the `<main>` (or content wrapper) level.
- Login route (`/login`) still renders full-bleed with no shell (existing behavior preserved) — no tab bar there.

### Active-tab logic
Reuse the existing `active` rule: `href === "/" ? pathname === "/" : pathname.startsWith(href)`. For "More", mark active when the current route is one of the overflow destinations.

---

## 2. Lead list → cards on mobile (`src/components/lead-table.tsx`)

- Below `md`: render a **`LeadCard`** list. At `md+`: render the existing `<table>` unchanged.
- `LeadCard` contents (single tap target → `onSelect(lead.id)`):
  - Row 1: `lead.name` (truncate) + `PriorityBadge` + `WebPresenceBadge`.
  - Row 2: host (`displayHost`) or "no site" (warning), and rating "★ x.x · N" when present.
  - Row 3: `ScoreBar` (score + number) and status (dot + `STATUS_LABEL`).
- Delete: an always-visible trash control, ≥44px tap area, top-right of the card, `stopPropagation` + existing `confirm()` guard. Only rendered when `onDelete` is provided (same as today).
- Disqualified leads keep the `opacity-45` treatment.
- Update `TableSkeleton` to also provide a card-shaped skeleton on mobile (or a shared skeleton that reads acceptably in both).

---

## 3. Lead drawer → bottom sheet on mobile (`src/components/lead-drawer.tsx`)

### 3.1 Behavior
- `md+`: keep the right-side sliding panel (`max-w-xl`, slides from right) exactly as today.
- `< md`: render as a **bottom sheet** — slides up from the bottom, rounded top corners, drag handle at top, `max-h ~92vh`, sticky header + sticky action footer, scrollable body. Dismiss via drag-down, backdrop tap, drag handle, or Esc.
- Keep `AnimatePresence` + framer-motion. Choose slide direction responsively (translateY from 100% on mobile, translateX from 100% at `md+`), or branch the motion variants on a `matchMedia`/breakpoint check.

### 3.2 Shared `BottomSheet` primitive
- Extract a small `BottomSheet` component (framer-motion) reused by (a) the mobile lead drawer and (b) the nav "More" menu.
- Props: `open`, `onClose`, `children`, optional title/`maxHeight`. Handles backdrop, drag-to-dismiss, Esc, and safe-area bottom padding.

### 3.3 Footer controls
- Priority and status buttons bumped to comfortable tap sizes (≥40px height on mobile), laid out to wrap cleanly (they already wrap; ensure spacing/target size). Industry editor input gets the shared 44px/16px field style.

---

## 4. Forms, filters & shared field styling

### 4.1 Filter rows (`src/app/leads/page.tsx`, `src/app/social/page.tsx`)
- Mobile layout:
  - Row 1: full-width search input.
  - Row 2: priority segmented control + status/sort selects as full-width (or a horizontally scrollable chip row), each ≥44px, 16px text.
- `sm+`: keep the current inline `flex-wrap` row.

### 4.2 Input-bearing components
Apply 44px height + 16px-on-mobile + full-width mobile buttons to:
- `src/components/add-lead.tsx`
- `src/components/add-instagram-lead.tsx` (including the blocked-fallback grid inputs)
- `src/components/lead-lookup.tsx`
- `src/app/login/page.tsx`
- `src/app/settings/page.tsx` — provider cards **stack vertically** on mobile (avoid the cramped `justify-between` row); "Use this" button comfortable size.
- `src/app/scraper/page.tsx` — mode tabs, industry/location inputs, range slider thumb, Start button bumped; controls card full-width on mobile (already stacks).

### 4.3 Centralize field styling
- Introduce a shared input style so the repeated `input-glow h-9 … bg-surface-2 … text-sm` declarations become one source of truth. Options: a `.field` utility class in `globals.css` (16px mobile / 14px `sm+`, 44px mobile height) **or** small `Input`/`Select`/`Textarea` wrappers in `src/components/ui.tsx`. Prefer the approach that changes the fewest call sites while staying consistent. Update `Button` sizes so the default `md` is a comfortable height on mobile.

---

## 5. Lighter touches

- **Campaigns** (`src/app/campaigns/page.tsx`): keep swipeable columns; widen cards to ~85% on the smallest screens, bump card tap targets. Otherwise as-is.
- **Analytics** (`src/app/analytics/page.tsx`): keep single-column charts on mobile. Fix the "Leads by industry" horizontal bar chart clipping its Y-axis labels on narrow screens (reduce/auto-size `YAxis width`, or truncate labels). KPI cards remain 2-col on mobile.

---

## Components / files expected to change

- `src/app/layout.tsx` — viewport/themeColor export.
- `src/app/globals.css` — safe-area utilities, tap-highlight/touch-action base, `.field` styling, any card/tabbar helpers.
- `src/components/app-shell.tsx` — bottom tab bar + More sheet; remove mobile hamburger drawer; content bottom padding.
- `src/components/lead-table.tsx` — mobile card list + card skeleton.
- `src/components/lead-drawer.tsx` — responsive bottom-sheet behavior; footer target sizes.
- `src/components/ui.tsx` — `Button` mobile sizing; possibly `Input`/`Select`/`Textarea` wrappers; new `BottomSheet`.
- `src/components/add-lead.tsx`, `add-instagram-lead.tsx`, `lead-lookup.tsx` — field sizing.
- `src/app/leads/page.tsx`, `social/page.tsx` — filter row mobile layout.
- `src/app/scraper/page.tsx`, `settings/page.tsx`, `login/page.tsx`, `campaigns/page.tsx`, `analytics/page.tsx` — targeted mobile fixes.

## Verification

- Drive the running app with Playwright at ~390×844 (iPhone-ish):
  - No horizontal page scroll on any route.
  - Bottom tab bar reachable and not overlapped by content; safe-area respected.
  - Focusing an input does not trigger zoom (font-size ≥ 16px on mobile).
  - Lead cards render and open the bottom-sheet drawer; drawer dismisses by drag/backdrop.
  - "More" sheet lists Social/Analytics/Settings + theme toggle.
- Spot-check desktop (≥1280px) is visually unchanged.
- `npm run build` (typecheck) passes; `npm test` (vitest) stays green.

## Out of scope

New features, rebrand/restyle, data/model/API changes, PWA/offline, advanced gestures beyond basic swipe-to-dismiss.
