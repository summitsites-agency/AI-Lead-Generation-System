"use client";

import { ExternalLink, X, Trash2 } from "lucide-react";
import type { Lead } from "@/lib/types";
import { ScoreBar, PriorityBadge, Pill, WebPresenceBadge } from "@/components/ui";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/status";
import { displayHost, fmt, cn } from "@/lib/utils";

export function LeadTable({
  leads,
  loading,
  onSelect,
  onDelete,
}: {
  leads: Lead[];
  loading?: boolean;
  onSelect: (id: number) => void;
  onDelete?: (id: number) => void;
}) {
  if (loading) return <TableSkeleton />;

  if (!leads.length) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface/40 p-12 text-center">
        <p className="text-sm text-text-secondary">No leads yet.</p>
        <p className="mt-1 text-xs text-text-muted">
          Run a scan from the Scraper page to populate your pipeline.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: tappable cards (no sideways scrolling) */}
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
              <span className="min-w-0 flex-1 truncate font-medium text-text-primary">
                {lead.name}
              </span>
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
                  · <span className="text-warning">★</span> {lead.rating.toFixed(1)} (
                  {fmt(lead.review_count)})
                </span>
              )}
            </div>
            <div className="mt-2.5">
              <ScoreBar score={lead.lead_score} />
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-text-secondary">
              <span
                className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[lead.status] ?? "bg-text-muted")}
              />
              {STATUS_LABEL[lead.status] ?? lead.status}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: full data table */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface/60 text-left text-xs text-text-muted">
            <th className="px-3 py-2.5 font-medium sm:px-4">Business</th>
            <th className="hidden px-3 py-2.5 font-medium sm:px-4 md:table-cell">Industry</th>
            <th className="hidden px-3 py-2.5 font-medium sm:px-4 lg:table-cell">Demand</th>
            <th className="w-32 px-3 py-2.5 font-medium sm:w-48 sm:px-4">Lead score</th>
            <th className="hidden px-3 py-2.5 font-medium sm:px-4 lg:table-cell">Website</th>
            <th className="px-3 py-2.5 font-medium sm:px-4">Status</th>
            {onDelete && <th className="w-10 px-2 py-2.5" />}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              onClick={() => onSelect(lead.id)}
              className={cn(
                "group cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-primary/[0.06]",
                lead.status === "not_a_lead" && "opacity-45"
              )}
            >
              <td className="px-3 py-3 sm:px-4">
                <div className="flex items-center gap-2">
                  <span className="inline-block max-w-[160px] truncate align-bottom font-medium text-text-primary sm:max-w-[240px] xl:max-w-[320px]">
                    {lead.name}
                  </span>
                  <PriorityBadge priority={lead.priority} />
                  <WebPresenceBadge presence={lead.web_presence} website={lead.website} />
                </div>
              </td>
              <td className="hidden px-4 py-3 md:table-cell">
                {lead.industry ? <Pill>{lead.industry}</Pill> : <span className="text-text-muted">—</span>}
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">
                {lead.rating != null ? (
                  <span className="tnum whitespace-nowrap text-xs text-text-secondary">
                    {lead.rating.toFixed(1)} <span className="text-warning">★</span>
                    <span className="text-text-muted"> · {fmt(lead.review_count)}</span>
                  </span>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </td>
              <td className="px-3 py-3 sm:px-4">
                <ScoreBar score={lead.lead_score} />
              </td>
              <td className="hidden px-4 py-3 lg:table-cell">
                {lead.website.startsWith("http") ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1 text-text-secondary hover:text-primary"
                  >
                    {displayHost(lead.website)}
                    <ExternalLink size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                ) : (
                  <span className="text-warning">no site</span>
                )}
              </td>
              <td className="px-3 py-3 sm:px-4">
                <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                  <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[lead.status] ?? "bg-text-muted")} />
                  {STATUS_LABEL[lead.status] ?? lead.status}
                </span>
              </td>
              {onDelete && (
                <td className="px-2 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${lead.name}"? This can't be undone.`)) onDelete(lead.id);
                    }}
                    title="Delete lead"
                    className="rounded p-1 text-text-muted/70 transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <X size={15} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-border/60 p-4 last:border-0">
          <div className="skeleton h-4 w-40 rounded" />
          <div className="skeleton h-4 w-20 rounded" />
          <div className="skeleton ml-auto h-2 w-40 rounded" />
        </div>
      ))}
    </div>
  );
}
