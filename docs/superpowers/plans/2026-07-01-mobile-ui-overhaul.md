# Mobile-First UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Summit Sites lead-intelligence app comfortable to use primarily on a phone, without changing the dark visual identity or the desktop layout.

**Architecture:** Mobile-first Tailwind. Default (unprefixed) classes target phones; `sm:`/`md:` restore existing desktop behavior. New shared primitives (`.field` input style, `BottomSheet`) keep changes DRY. Navigation forks: bottom tab bar below `md`, existing sidebar at `md+`. Dense surfaces (lead list, lead drawer) fork: cards/sheet on mobile, table/side-panel on desktop.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind v4 (`@theme` CSS-vars), framer-motion, lucide-react, recharts.

**Verification model:** Because these are visual changes, each task ends with `npx tsc --noEmit` (fast typecheck). The final task drives the running app with Playwright at a phone viewport and runs `npm run build` + `npm test`. No new UI unit tests — the existing vitest suite (`src/lib` logic) must stay green and is not expanded.

**Spec:** `docs/superpowers/specs/2026-07-01-mobile-ui-overhaul-design.md`

---

## File Structure

**New responsibilities:**
- `src/components/ui.tsx` — gains a `BottomSheet` primitive and mobile-aware `Button` sizing (existing badges/Card/ScoreBar stay).
- `src/app/globals.css` — gains safe-area utilities, tap/touch base rules, and a `.field` input style (single source of truth for form controls).

**Modified:**
- `src/app/layout.tsx` — `viewport` export.
- `src/components/app-shell.tsx` — bottom tab bar + More sheet; remove mobile hamburger drawer; content bottom padding.
- `src/components/lead-table.tsx` — mobile card list + card skeleton.
- `src/components/lead-drawer.tsx` — responsive bottom-sheet vs side-panel; footer tap sizes.
- `src/app/leads/page.tsx`, `src/app/social/page.tsx` — filter-row mobile layout.
- `src/components/add-lead.tsx`, `add-instagram-lead.tsx`, `lead-lookup.tsx` — `.field` inputs, full-width mobile buttons.
- `src/app/login/page.tsx`, `settings/page.tsx`, `scraper/page.tsx` — `.field` inputs, mobile fixes.
- `src/app/campaigns/page.tsx`, `analytics/page.tsx` — lighter mobile touches.

---

## Task 1: Global foundations (viewport, safe areas, touch, `.field`)

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add the `viewport` export to `layout.tsx`**

Add alongside the existing `metadata` export:

```tsx
import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
  ],
};
```

- [ ] **Step 2: Add base touch rules + safe-area utilities + `.field` to `globals.css`**

Append after the existing base rules (near the `body` block / before `.tnum`):

```css
/* Kill the grey tap flash and double-tap zoom on interactive controls (mobile) */
button, a, [role="button"], input, select, textarea, label {
  -webkit-tap-highlight-color: transparent;
}
button, a, [role="button"] {
  touch-action: manipulation;
}

/* Safe-area helpers for notched phones / home indicator */
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.pt-safe { padding-top: env(safe-area-inset-top); }
.h-tabbar { height: 56px; }

/* Shared form-control style. 16px on mobile prevents iOS focus-zoom; 14px at sm+.
   44px min-height on mobile for comfortable taps; 36px at sm+. */
.field {
  width: 100%;
  height: 2.75rem;               /* 44px */
  border-radius: 0.5rem;
  border: 1px solid var(--border);
  background: var(--surface-2);
  padding: 0 0.75rem;
  font-size: 16px;
  color: var(--text-primary);
}
textarea.field { height: auto; padding: 0.625rem 0.75rem; line-height: 1.5; }
.field:focus { outline: none; border-color: var(--primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 22%, transparent); }
@media (min-width: 640px) {
  .field { height: 2.25rem; font-size: 0.875rem; }  /* 36px / 14px */
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(mobile): viewport, safe-area utils, touch rules, shared .field style"
```

---

## Task 2: `BottomSheet` primitive + mobile `Button` sizing

**Files:**
- Modify: `src/components/ui.tsx`

- [ ] **Step 1: Add `useIsMobile` hook + `BottomSheet` to `ui.tsx`**

Add at the top (after imports, needs `"use client"` — see Step 3) and export `BottomSheet`:

```tsx
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/** True below Tailwind's md breakpoint (768px). SSR-safe (false first paint). */
export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

export function BottomSheet({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex max-h-[92vh] flex-col rounded-t-2xl border-t border-border bg-surface pb-safe shadow-2xl",
              className
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose();
            }}
          >
            <div className="flex shrink-0 justify-center py-2.5">
              <div className="h-1.5 w-10 rounded-full bg-border-strong" />
            </div>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Bump `Button` sizing for mobile**

Replace the `sizes` map in `Button` so the default is comfortable on phones and compact at `sm+`:

```tsx
const sizes = {
  sm: "h-9 px-3 text-xs sm:h-8",
  md: "h-11 px-4 text-sm sm:h-9",
};
```

- [ ] **Step 3: Ensure `ui.tsx` is a client module**

`BottomSheet`/`useIsMobile` use hooks + framer-motion. Add `"use client";` as the first line of `src/components/ui.tsx` if not already present.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui.tsx
git commit -m "feat(mobile): BottomSheet primitive, useIsMobile, comfortable mobile buttons"
```

---

## Task 3: App shell — bottom tab bar + More sheet

**Files:**
- Modify: `src/components/app-shell.tsx`

- [ ] **Step 1: Define primary tabs + overflow, and reuse `BottomSheet`**

Keep the existing `NAV` array (sidebar uses it unchanged). Add below it:

```tsx
const PRIMARY = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/scraper", label: "Scraper", icon: Radar },
  { href: "/campaigns", label: "Campaigns", icon: Send },
] as const;

const OVERFLOW = [
  { href: "/social", label: "Social Leads", icon: AtSign },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
```

Import `BottomSheet` from `@/components/ui` and `MoreHorizontal` from `lucide-react`.

- [ ] **Step 2: Remove the mobile hamburger drawer; keep sidebar desktop-only**

- Change the `<aside>` so it is desktop-only: it should no longer slide in on mobile. Simplest: add `hidden md:flex` to the `<aside>` classes and drop the mobile `translate-x` logic and the mobile backdrop block and the `mobileOpen` state.
- Remove the header hamburger `<button>` (the one with `Menu`) and the `Menu`/`X` imports if now unused. Keep `PageTitle` and `ThemeToggle` in the header.
- Keep the `usePathname` + `pathname === "/login"` early return.

- [ ] **Step 3: Add the bottom tab bar + More sheet before the closing `</div>` of the shell**

Add a `const [moreOpen, setMoreOpen] = useState(false);` and close it on navigation (`useEffect(() => setMoreOpen(false), [pathname])`). Render after `<main>`:

```tsx
{/* Bottom tab bar — mobile only */}
<nav className="fixed inset-x-0 bottom-0 z-40 flex h-tabbar items-stretch border-t border-border bg-surface pb-safe md:hidden">
  {PRIMARY.map(({ href, label, icon: Icon }) => {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
          active ? "text-primary" : "text-text-secondary"
        )}
      >
        <Icon size={20} />
        {label}
      </Link>
    );
  })}
  <button
    onClick={() => setMoreOpen(true)}
    className={cn(
      "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
      OVERFLOW.some((o) => pathname.startsWith(o.href)) ? "text-primary" : "text-text-secondary"
    )}
  >
    <MoreHorizontal size={20} />
    More
  </button>
</nav>

<BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)}>
  <div className="space-y-1 px-3 pb-4">
    {OVERFLOW.map(({ href, label, icon: Icon }) => {
      const active = pathname.startsWith(href);
      return (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-3 text-sm",
            active ? "bg-primary/12 text-text-primary" : "text-text-secondary hover:bg-hover"
          )}
        >
          <Icon size={18} className={cn(active && "text-primary")} />
          {label}
        </Link>
      );
    })}
    <div className="flex items-center justify-between rounded-lg px-3 py-3 text-sm text-text-secondary">
      <span>Theme</span>
      <ThemeToggle />
    </div>
  </div>
</BottomSheet>
```

- [ ] **Step 4: Give `<main>` bottom clearance for the tab bar**

Change the `<main>` className to:

```tsx
<main className="min-h-0 flex-1 overflow-y-auto pb-[calc(56px+env(safe-area-inset-bottom))] md:pb-0">
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (verify no unused imports remain — remove `Menu`, `X`, `PanelLeft*` only if actually unused; the collapse button still uses `PanelLeft`/`PanelLeftClose`).

- [ ] **Step 6: Commit**

```bash
git add src/components/app-shell.tsx
git commit -m "feat(mobile): bottom tab bar + More sheet; sidebar becomes desktop-only"
```

---

## Task 4: Lead list — cards on mobile

**Files:**
- Modify: `src/components/lead-table.tsx`

- [ ] **Step 1: Wrap the existing table so it only shows at `md+`**

Change the table wrapper `div` to `className="hidden overflow-x-auto rounded-xl border border-border md:block"`. Leave the table markup as-is inside it.

- [ ] **Step 2: Add a mobile card list rendered below `md`**

Import `ScoreBar, PriorityBadge, WebPresenceBadge` (already imported) and `Trash2` from `lucide-react`. Add, before the `return` of the table block, a mobile list that maps `leads`:

```tsx
<div className="space-y-2 md:hidden">
  {leads.map((lead) => (
    <div
      key={lead.id}
      onClick={() => onSelect(lead.id)}
      className={cn(
        "rounded-xl border border-border bg-surface p-3.5 active:bg-primary/[0.06]",
        lead.status === "not_a_lead" && "opacity-45"
      )}
    >
      <div className="flex items-start gap-2">
        <span className="min-w-0 flex-1 truncate font-medium text-text-primary">{lead.name}</span>
        <PriorityBadge priority={lead.priority} />
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete "${lead.name}"? This can't be undone.`)) onDelete(lead.id);
            }}
            aria-label="Delete lead"
            className="-m-2 grid h-11 w-11 shrink-0 place-items-center text-text-muted/70 active:text-danger"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
        <WebPresenceBadge presence={lead.web_presence} website={lead.website} />
        <span className="truncate">
          {lead.website.startsWith("http") ? displayHost(lead.website) : "no site"}
        </span>
        {lead.rating != null && (
          <span className="tnum whitespace-nowrap">
            · <span className="text-warning">★</span> {lead.rating.toFixed(1)} ({fmt(lead.review_count)})
          </span>
        )}
      </div>
      <div className="mt-2.5"><ScoreBar score={lead.lead_score} /></div>
      <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-secondary">
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[lead.status] ?? "bg-text-muted")} />
        {STATUS_LABEL[lead.status] ?? lead.status}
      </div>
    </div>
  ))}
</div>
```

Both blocks (mobile list + desktop table wrapper) render together; visibility is handled by `md:hidden` / `hidden md:block`. Wrap them in a `<>...</>` fragment in the component's return.

- [ ] **Step 3: Make the skeleton acceptable on both**

`TableSkeleton`'s current rounded rows read fine as cards. Add `md:` nothing — leave as-is (it already renders stacked rows). No change required.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/lead-table.tsx
git commit -m "feat(mobile): render leads as cards below md, table at md+"
```

---

## Task 5: Lead drawer — bottom sheet on mobile

**Files:**
- Modify: `src/components/lead-drawer.tsx`

- [ ] **Step 1: Make the panel responsive (bottom sheet on mobile, side panel on desktop)**

In `LeadDrawer`, import `useIsMobile` from `@/components/ui`. Compute `const mobile = useIsMobile();` and drive the `motion.aside` variants + classes off it:

```tsx
<motion.aside
  className={cn(
    "fixed z-50 flex flex-col border-border bg-surface shadow-2xl",
    mobile
      ? "inset-x-0 bottom-0 max-h-[92vh] rounded-t-2xl border-t pb-safe"
      : "inset-y-0 right-0 w-full max-w-xl border-l"
  )}
  initial={mobile ? { y: "100%" } : { x: "100%" }}
  animate={mobile ? { y: 0 } : { x: 0 }}
  exit={mobile ? { y: "100%" } : { x: "100%" }}
  transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
>
```

Leave the backdrop `motion.div` and `AnimatePresence` as they are.

- [ ] **Step 2: Add a drag handle on mobile**

Immediately inside `DrawerBody` and `DrawerSkeleton`'s root `div`, render a handle only on mobile:

```tsx
<div className="flex shrink-0 justify-center py-2 md:hidden">
  <div className="h-1.5 w-10 rounded-full bg-border-strong" />
</div>
```

(Add to both `DrawerBody` and `DrawerSkeleton` so the header still looks right during load.)

- [ ] **Step 3: Enlarge footer priority/status tap targets**

In the footer, change the priority and status buttons' padding from `px-2.5 py-1` to `px-3 py-2` and the industry input to use the shared style: replace its className `input-glow h-8 flex-1 rounded-md border border-border bg-surface-2 px-2 text-xs` with `field flex-1` (keep it compact by allowing the `sm` default; acceptable at 44px on mobile).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/lead-drawer.tsx
git commit -m "feat(mobile): lead drawer becomes a bottom sheet on phones"
```

---

## Task 6: Filter rows on Leads + Social

**Files:**
- Modify: `src/app/leads/page.tsx`
- Modify: `src/app/social/page.tsx`

- [ ] **Step 1: Leads — stack filters cleanly on mobile**

Replace the filter container `div` (`flex flex-wrap items-center gap-3`) with a mobile-stacked layout:

```tsx
<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
```

Change the search wrapper to `className="relative w-full sm:flex-1 sm:min-w-48"`, and its `<input>` to use the shared field style: `className="field input-glow pl-9"` (keep `pl-9` for the icon; drop the old `h-9 … text-sm` bits). Change the priority segmented control wrapper to `className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1"` unchanged, but its buttons to `py-2` for taller taps. Change both `<select>`s to `className="field input-glow w-full sm:w-auto"`.

- [ ] **Step 2: Social — same treatment**

In `social/page.tsx`, change the filter container to `flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3`, the search wrapper to `relative w-full sm:flex-1 sm:min-w-48` with input `className="field input-glow pl-9"`, and the sort `<select>` to `className="field input-glow w-full sm:w-auto"`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/leads/page.tsx src/app/social/page.tsx
git commit -m "feat(mobile): full-width stacked filters on Leads and Social"
```

---

## Task 7: Field sizing across forms (add-lead, add-instagram, lookup, login, settings, scraper)

**Files:**
- Modify: `src/components/add-lead.tsx`
- Modify: `src/components/add-instagram-lead.tsx`
- Modify: `src/components/lead-lookup.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/settings/page.tsx`
- Modify: `src/app/scraper/page.tsx`

For each, the pattern is: replace bespoke input classes `input-glow h-8|h-9|h-10 … bg-surface-2 … text-xs|text-sm` with `field input-glow` (add back any extra utility like `pl-9` or `resize-y`). Buttons that are `sm:shrink-0`/inline should become full-width on mobile where they sit under an input.

- [ ] **Step 1: `add-lead.tsx`**

Input → `className="field input-glow flex-1"`. Button → add `className="w-full sm:w-auto sm:shrink-0"`.

- [ ] **Step 2: `add-instagram-lead.tsx`**

Handle input → `className="field input-glow flex-1"`. Button → `className="w-full sm:w-auto sm:shrink-0"`. The four fallback grid inputs → `className="field input-glow"` (they sit in `grid grid-cols-2 gap-2`; keep the grid).

- [ ] **Step 3: `lead-lookup.tsx`**

Every `<input>` (`name`, `city`, and each `DraftField` input) → `className="field input-glow"`; `DraftField` keeps its gap-border logic by swapping only the size bits: `cn("field input-glow", gap ? "border-warning/60" : "")`. Buttons already `w-full`.

- [ ] **Step 4: `login/page.tsx`**

Password input → `className="field input-glow mb-3"`. Button already `w-full`.

- [ ] **Step 5: `settings/page.tsx` — stack provider cards on mobile**

Change the provider card inner `div` from `flex items-center justify-between gap-4` to `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`. Change the right block `flex flex-col items-end gap-2` to `flex flex-row items-center gap-2 sm:flex-col sm:items-end`. "Use this" button → `className="w-full sm:w-auto"`.

- [ ] **Step 6: `scraper/page.tsx`**

Industry + location inputs → `className="field input-glow"`. The import `<textarea>` → `className="field input-glow resize-y"` with `rows={8}` kept. Mode tab buttons → change `py-1.5` to `py-2`. Start/Stop button already `flex-1`. Leave the range slider as-is (native control; already full width).

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/add-lead.tsx src/components/add-instagram-lead.tsx src/components/lead-lookup.tsx src/app/login/page.tsx src/app/settings/page.tsx src/app/scraper/page.tsx
git commit -m "feat(mobile): 44px/16px form controls via shared .field, mobile-friendly buttons"
```

---

## Task 8: Campaigns + Analytics lighter touches

**Files:**
- Modify: `src/app/campaigns/page.tsx`
- Modify: `src/app/analytics/page.tsx`

- [ ] **Step 1: Campaigns — widen columns + bigger card taps on the smallest screens**

Change each column wrapper width classes from `w-[80%] … sm:w-[45%]` to `w-[85%] … sm:w-[46%]` and card buttons from `p-3` to `p-3.5`. (Snap/scroll behavior stays.)

- [ ] **Step 2: Analytics — stop the industry chart clipping Y labels**

On the "Leads by industry" `BarChart`, reduce the `YAxis` `width` from `90` to `72` and add `tick={{ fontSize: 11 }}`. Keep everything else.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/campaigns/page.tsx src/app/analytics/page.tsx
git commit -m "feat(mobile): wider campaign cards, non-clipping industry chart"
```

---

## Task 9: Verification (build, tests, live phone check)

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + unit tests + production build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: typecheck clean; vitest all pass; build succeeds.

- [ ] **Step 2: Start the dev server**

Run (background): `npm run dev`
Expected: server on http://localhost:3000.

- [ ] **Step 3: Drive it at a phone viewport with Playwright MCP**

Resize the browser to 390×844, then for each route (`/login` if gated, `/`, `/leads`, `/social`, `/scraper`, `/campaigns`, `/analytics`, `/settings`) confirm:
- No horizontal page scroll (body scrollWidth ≈ viewport width).
- Bottom tab bar visible, tappable, not overlapping content; "More" opens the sheet with Social/Analytics/Settings + theme.
- On `/leads`: leads render as cards; tapping one opens the drawer as a bottom sheet; it dismisses via backdrop and drag-down.
- Focusing a search/URL input does not zoom the page (computed font-size ≥ 16px on mobile).
Take a screenshot of `/leads` (cards) and the open lead drawer for the record.

- [ ] **Step 4: Spot-check desktop unchanged**

Resize to 1280×900 and confirm `/` and `/leads` show the sidebar + table exactly as before (no tab bar, no cards).

- [ ] **Step 5: Final commit if any verification fixes were needed**

```bash
git add -A
git commit -m "fix(mobile): verification adjustments"
```

(Skip if nothing changed.)

---

## Self-Review Notes

- **Spec coverage:** §0 → Task 1; §1 → Task 3; §2 → Task 4; §3 → Tasks 2 (BottomSheet) + 5; §4 → Tasks 1 (`.field`) + 6 + 7; §5 → Task 8; Verification → Task 9. All spec sections mapped.
- **Type consistency:** `useIsMobile` and `BottomSheet` are defined in Task 2 (`ui.tsx`) and consumed in Tasks 3 and 5. `.field`/`.pb-safe`/`.h-tabbar` defined in Task 1, used in Tasks 3–7. `PRIMARY`/`OVERFLOW` defined and used within Task 3.
- **No placeholders:** every code step shows the concrete change.
