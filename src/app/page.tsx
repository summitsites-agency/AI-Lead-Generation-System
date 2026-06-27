"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Radar, ArrowRight, AtSign } from "lucide-react";
import type { Lead } from "@/lib/types";
import type { Stats } from "@/lib/db/leads";
import { fetchLeads, fetchStats, deleteLead } from "@/lib/api";
import { KpiCards } from "@/components/kpi-cards";
import { LeadTable } from "@/components/lead-table";
import { LeadDrawer } from "@/components/lead-drawer";
import { Button, Card } from "@/components/ui";

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([fetchStats(), fetchLeads({ sort: "score", hideDisqualified: true })])
      .then(([s, l]) => {
        setStats(s.stats);
        setLeads(l);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const onDelete = async (id: number) => {
    await deleteLead(id);
    if (selected === id) setSelected(null);
    load();
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Lead intelligence overview</h2>
          <p className="text-sm text-text-secondary">
            Ranked opportunities from your latest scans.
          </p>
        </div>
        <Link href="/scraper">
          <Button>
            <Radar size={16} /> New scan
          </Button>
        </Link>
      </div>

      <KpiCards stats={stats} loading={loading} />

      {!loading && stats && stats.noSite > 0 && (
        <Link href="/social" className="block">
          <Card className="card-glow flex items-center justify-between gap-3 p-4 transition-colors hover:border-primary/40">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warning/12 text-warning">
                <AtSign size={17} />
              </div>
              <div>
                <div className="text-sm font-medium">
                  {stats.noSite} social lead{stats.noSite === 1 ? "" : "s"} with no real website
                </div>
                <div className="text-xs text-text-secondary">
                  Instagram-only, social, or directory listings — analyze and pitch them a site.
                </div>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs text-text-secondary">
              View <ArrowRight size={13} />
            </span>
          </Card>
        </Link>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Top opportunities</h3>
          <Link
            href="/leads"
            className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-primary"
          >
            View all <ArrowRight size={13} />
          </Link>
        </div>
        <LeadTable leads={leads.slice(0, 10)} loading={loading} onSelect={setSelected} onDelete={onDelete} />
      </div>

      <LeadDrawer leadId={selected} onClose={() => setSelected(null)} onStatusChange={load} />
    </div>
  );
}
