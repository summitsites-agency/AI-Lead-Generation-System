"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  AtSign,
  Radar,
  Send,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Mountain,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/social", label: "Social Leads", icon: AtSign },
  { href: "/scraper", label: "Scraper", icon: Radar },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever we navigate to a new page.
  useEffect(() => setMobileOpen(false), [pathname]);

  // Esc closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // The login screen renders full-bleed, without the app nav/header.
  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary">
      {/* Backdrop — mobile only, behind the drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-overlay md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — static on desktop, slide-in drawer on mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-surface transition-transform duration-200 ease-out",
          "md:static md:z-auto md:translate-x-0 md:bg-surface/60 md:transition-[width]",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "md:w-[68px]" : "md:w-60"
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Mountain size={18} />
          </div>
          {/* Title hides only when desktop-collapsed; always shown in the mobile drawer */}
          <div className={cn("min-w-0", collapsed && "md:hidden")}>
            <div className="truncate text-sm font-semibold leading-tight">Summit Sites</div>
            <div className="truncate text-[11px] text-text-muted">Lead Intelligence</div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-text-muted transition-colors hover:bg-hover hover:text-text-primary md:hidden"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 md:py-2",
                  active
                    ? "bg-primary/12 text-text-primary"
                    : "text-text-secondary hover:bg-hover hover:text-text-primary"
                )}
              >
                <Icon size={18} className={cn("shrink-0", active && "text-primary")} />
                <span className={cn("truncate", collapsed && "md:hidden")}>{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle is desktop-only — pointless on a full-width drawer */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-2 hidden items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-hover hover:text-text-primary md:flex"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileOpen(true)}
              className="-ml-1.5 rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-hover hover:text-text-primary md:hidden"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <PageTitle pathname={pathname} />
          </div>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Local engine
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

function PageTitle({ pathname }: { pathname: string }) {
  const match = NAV.find((n) =>
    n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)
  );
  return (
    <h1 className="text-sm font-semibold tracking-tight text-text-primary">
      {match?.label ?? "Dashboard"}
    </h1>
  );
}
