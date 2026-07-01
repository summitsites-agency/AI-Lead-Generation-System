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
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomSheet } from "@/components/ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/social", label: "Social Leads", icon: AtSign },
  { href: "/scraper", label: "Scraper", icon: Radar },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

// Mobile bottom-tab split: four primary destinations + a "More" sheet for the rest.
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

const isActive = (href: string, pathname: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();

  // Close the "More" sheet whenever we navigate to a new page.
  useEffect(() => setMoreOpen(false), [pathname]);

  // The login screen renders full-bleed, without the app nav/header.
  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-text-primary">
      {/* Sidebar — desktop only; mobile uses the bottom tab bar */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-border bg-surface/60 transition-[width] md:flex",
          collapsed ? "md:w-[68px]" : "md:w-60"
        )}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Mountain size={18} />
          </div>
          <div className={cn("min-w-0", collapsed && "hidden")}>
            <div className="truncate text-sm font-semibold leading-tight">Summit Sites</div>
            <div className="truncate text-[11px] text-text-muted">Lead Intelligence</div>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                  active
                    ? "bg-primary/12 text-text-primary"
                    : "text-text-secondary hover:bg-hover hover:text-text-primary"
                )}
              >
                <Icon size={18} className={cn("shrink-0", active && "text-primary")} />
                <span className={cn("truncate", collapsed && "hidden")}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="m-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-hover hover:text-text-primary"
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4 sm:px-6">
          <PageTitle pathname={pathname} />
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Local engine
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>

      {/* Bottom tab bar — mobile only */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-tabbar items-stretch border-t border-border bg-surface pb-safe md:hidden">
        {PRIMARY.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                active ? "text-primary" : "text-text-secondary"
              )}
            >
              <Icon size={30} />
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium",
            OVERFLOW.some((o) => pathname.startsWith(o.href)) ? "text-primary" : "text-text-secondary"
          )}
        >
          <MoreHorizontal size={30} />
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
    </div>
  );
}

function PageTitle({ pathname }: { pathname: string }) {
  const match = NAV.find((n) => isActive(n.href, pathname));
  return (
    <h1 className="text-sm font-semibold tracking-tight text-text-primary">
      {match?.label ?? "Dashboard"}
    </h1>
  );
}
