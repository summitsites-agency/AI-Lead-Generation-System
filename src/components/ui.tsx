import { cn } from "@/lib/utils";
import type { Priority } from "@/lib/types";
import { priorityFromScore } from "@/lib/scoring";
import { webPresenceLabel, type WebPresence } from "@/lib/web-presence";

const PRIORITY_COLOR: Record<Priority, string> = {
  HIGH: "var(--success)", // green
  MEDIUM: "var(--warning)", // yellow
  LOW: "var(--danger)", // red
};

/**
 * Lead-score bar. The bar fill width is the raw lead score, but the COLOUR
 * follows the (inverted) priority so it matches the priority badge:
 * HIGH = green, MEDIUM = yellow, LOW = red.
 */
export function ScoreBar({ score, className }: { score: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, score));
  const color = PRIORITY_COLOR[priorityFromScore(pct)];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-track">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="tnum w-7 shrink-0 text-right text-xs font-medium" style={{ color }}>
        {pct}
      </span>
    </div>
  );
}

const PRIORITY_STYLE: Record<Priority, string> = {
  HIGH: "bg-success/12 text-success border-success/25",
  MEDIUM: "bg-warning/12 text-warning border-warning/25",
  LOW: "bg-danger/12 text-danger border-danger/25",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        PRIORITY_STYLE[priority]
      )}
    >
      {priority}
    </span>
  );
}

const PRESENCE_STYLE: Record<"none" | "social" | "directory", string> = {
  none: "bg-warning/12 text-warning border-warning/25",
  social: "bg-primary/12 text-primary border-primary/25",
  directory: "bg-fill-strong text-text-secondary border-border-strong",
};

/**
 * Badge marking a lead with no real website — "No website", "Instagram",
 * "Yelp", etc. Renders nothing for normal site leads.
 */
export function WebPresenceBadge({
  presence,
  website,
}: {
  presence: WebPresence;
  website: string;
}) {
  if (presence === "site") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        PRESENCE_STYLE[presence]
      )}
    >
      {webPresenceLabel(presence, website)}
    </span>
  );
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-fill px-2 py-0.5 text-[11px] text-text-secondary",
        className
      )}
    >
      {children}
    </span>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50";
  const sizes = { sm: "h-8 px-3 text-xs", md: "h-9 px-4 text-sm" };
  const variants = {
    primary: "bg-primary text-white hover:bg-primary-hover",
    secondary: "border border-border-strong bg-fill text-text-primary hover:bg-fill-strong",
    ghost: "text-text-secondary hover:bg-hover hover:text-text-primary",
    danger: "bg-danger/90 text-white hover:bg-danger",
  };
  return <button className={cn(base, sizes[size], variants[variant], className)} {...props} />;
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface", className)}>{children}</div>
  );
}
