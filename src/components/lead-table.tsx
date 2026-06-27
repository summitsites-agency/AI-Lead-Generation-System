"use client";

import { ExternalLink, X } from "lucide-react";
import type { Lead } from "@/lib/types";
import { ScoreBar, PriorityBadge, Pill, WebPresenceBadge } from "@/components/ui";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/status";
import { displayHost, cn } from "@/lib/utils";

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
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface/60 text-left text-xs text-text-muted">
            <th className="px-4 py-2.5 font-medium">Business</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">Industry</th>
            <th className="w-48 px-4 py-2.5 font-medium">Lead score</th>
            <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Website</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
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
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">{lead.name}</span>
                  <PriorityBadge priority={lead.priority} />
                  <WebPresenceBadge presence={lead.web_presence} website={lead.website} />
                </div>
              </td>
              <td className="hidden px-4 py-3 md:table-cell">
                {lead.industry ? <Pill>{lead.industry}</Pill> : <span className="text-text-muted">—</span>}
              </td>
              <td className="px-4 py-3">
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
              <td className="px-4 py-3">
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
                    className="rounded p-1 text-text-muted opacity-0 transition-colors hover:bg-danger/10 hover:text-danger group-hover:opacity-100"
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
