"use client";

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import type { Lead } from "@/lib/types";
import { fetchLeads, deleteLead } from "@/lib/api";
import { LeadTable } from "@/components/lead-table";
import { LeadDrawer } from "@/components/lead-drawer";
import { AddLead } from "@/components/add-lead";
import { cn } from "@/lib/utils";

const PRIORITIES = ["", "HIGH", "MEDIUM", "LOW"] as const;
const SORTS = [
  { value: "score", label: "Score" },
  { value: "recent", label: "Recent" },
  { value: "name", label: "Name" },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [priority, setPriority] = useState<string>("");
  const [sort, setSort] = useState("score");
  const [search, setSearch] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetchLeads({ priority, sort, search })
      .then(setLeads)
      .finally(() => setLoading(false));
  }, [priority, sort, search]);

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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search business or website…"
            className="input-glow h-9 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-3 text-sm"
          />
        </div>

        <div className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1">
          {PRIORITIES.map((p) => (
            <button
              key={p || "all"}
              onClick={() => setPriority(p)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                priority === p ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
              )}
            >
              {p || "All"}
            </button>
          ))}
        </div>

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="input-glow h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm"
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
