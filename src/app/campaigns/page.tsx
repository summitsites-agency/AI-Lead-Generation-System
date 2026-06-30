"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead, LeadStatus } from "@/lib/types";
import { fetchLeads } from "@/lib/api";
import { LeadDrawer } from "@/components/lead-drawer";
import { PriorityBadge } from "@/components/ui";
import { displayHost } from "@/lib/utils";

const COLUMNS: { status: LeadStatus; label: string; accent: string }[] = [
  { status: "new", label: "New", accent: "var(--primary)" },
  { status: "contacted", label: "Contacted", accent: "var(--warning)" },
  { status: "responded", label: "Responded", accent: "var(--success)" },
  { status: "won", label: "Won", accent: "var(--success)" },
  { status: "lost", label: "Lost", accent: "var(--text-muted)" },
];

export default function CampaignsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchLeads({ sort: "score", hideDisqualified: true })
      .then(setLeads)
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Campaign pipeline</h2>
        <p className="text-sm text-text-secondary">
          Track outreach by stage. Open a lead to update its status or copy a message.
        </p>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 md:grid md:snap-none md:grid-cols-3 md:overflow-visible md:pb-0 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const items = leads.filter((l) => l.status === col.status);
          return (
            <div key={col.status} className="w-[80%] shrink-0 snap-center rounded-xl border border-border bg-surface/40 sm:w-[45%] md:w-auto md:shrink">
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span className="h-2 w-2 rounded-full" style={{ background: col.accent }} />
                  {col.label}
                </span>
                <span className="tnum text-xs text-text-muted">{items.length}</span>
              </div>
              <div className="max-h-[60vh] space-y-2 overflow-y-auto p-2">
                {loading ? (
                  <div className="skeleton h-16 rounded-lg" />
                ) : items.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-text-muted">Empty</p>
                ) : (
                  items.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => setSelected(lead.id)}
                      className="w-full rounded-lg border border-border bg-surface p-3 text-left transition-colors hover:border-border-strong"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-medium">{lead.name}</span>
                        <PriorityBadge priority={lead.priority} />
                      </div>
                      <div className="mt-1 truncate text-xs text-text-muted">
                        {lead.website.startsWith("http") ? displayHost(lead.website) : "no website"}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <LeadDrawer leadId={selected} onClose={() => setSelected(null)} onStatusChange={load} />
    </div>
  );
}
