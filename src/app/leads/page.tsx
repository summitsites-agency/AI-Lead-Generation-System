"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { Lead } from "@/lib/types";
import { fetchLeads, deleteLead } from "@/lib/api";
import { LeadTable } from "@/components/lead-table";
import { LeadDrawer } from "@/components/lead-drawer";
import { AddLead } from "@/components/add-lead";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, LEAD_STATUSES } from "@/lib/status";

const PRIORITIES = ["", "HIGH", "MEDIUM", "LOW"] as const;
const SORTS = [
  { value: "rank", label: "Best leads" },
  { value: "score", label: "Score" },
  { value: "status", label: "Status" },
  { value: "recent", label: "Recent" },
  { value: "name", label: "Name" },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [priority, setPriority] = useState<string>("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("rank");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetchLeads({ priority, status, sort, search })
      .then(setLeads)
      .finally(() => setLoading(false));
  }, [priority, status, sort, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const onAdded = (leadId: number) => {
    load();
    setSelected(leadId);
  };

  const onDelete = async (id: number) => {
    await deleteLead(id);
    if (selected === id) setSelected(null);
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <AddLead onAdded={onAdded} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business or website…"
            className="field input-glow pl-9"
          />
        </div>

        <div className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1">
          {PRIORITIES.map((p) => (
            <button
              key={p || "all"}
              onClick={() => setPriority(p)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors sm:flex-none",
                priority === p ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
              )}
            >
              {p || "All"}
            </button>
          ))}
        </div>

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="field input-glow w-full sm:w-auto"
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="field input-glow w-full sm:w-auto"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="text-xs text-text-muted">
        {loading ? "Loading…" : `${leads.length} lead${leads.length === 1 ? "" : "s"}`}
      </div>

      <LeadTable leads={leads} loading={loading} onSelect={setSelected} onDelete={onDelete} />

      <LeadDrawer leadId={selected} onClose={() => setSelected(null)} onStatusChange={load} />
    </div>
  );
}
