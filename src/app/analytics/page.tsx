"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  Tooltip,
  PieChart,
  Pie,
} from "recharts";
import type { Stats } from "@/lib/db/leads";
import type { ScanJob } from "@/lib/types";
import { fetchStats } from "@/lib/api";
import { KpiCards } from "@/components/kpi-cards";
import { Card } from "@/components/ui";

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "#10b981",
  MEDIUM: "#f59e0b",
  LOW: "#ef4444",
};
// Score buckets [0–40, 41–70, 71–100] coloured by their priority:
// 0–40 = LOW (red), 41–70 = MEDIUM (yellow), 71–100 = HIGH (green).
const BUCKET_COLORS = ["#ef4444", "#f59e0b", "#10b981"];

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats>();
  const [scans, setScans] = useState<ScanJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats()
      .then((d) => {
        setStats(d.stats);
        setScans(d.recentScans);
      })
      .finally(() => setLoading(false));
  }, []);

  const priorityData = stats
    ? (["HIGH", "MEDIUM", "LOW"] as const).map((p) => ({ name: p, value: stats.byPriority[p] }))
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <KpiCards stats={stats} loading={loading} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Lead score distribution</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.scoreBuckets ?? []}>
                <XAxis dataKey="bucket" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  cursor={{ fill: "var(--hover)" }}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {(stats?.scoreBuckets ?? []).map((_, i) => (
                    <Cell key={i} fill={BUCKET_COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Priority mix</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {priorityData.map((d) => (
                    <Cell key={d.name} fill={PRIORITY_COLORS[d.name]} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            {priorityData.map((d) => (
              <span key={d.name} className="flex items-center gap-1.5 text-text-secondary">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: PRIORITY_COLORS[d.name] }}
                />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Leads by industry</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats?.byIndustry ?? []} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" stroke="#6b7280" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="industry"
                  stroke="#6b7280"
                  fontSize={12}
                  width={72}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip cursor={{ fill: "var(--hover)" }} contentStyle={tooltipStyle} />
                <Bar dataKey="count" fill="#3b82f6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold">Recent scans</h3>
          {scans.length === 0 ? (
            <p className="text-sm text-text-muted">No scans yet.</p>
          ) : (
            <div className="space-y-2">
              {scans.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {s.industry || "—"}{" "}
                      <span className="text-text-muted">{s.location && `· ${s.location}`}</span>
                    </div>
                    <div className="text-xs text-text-muted">{s.created_at}</div>
                  </div>
                  <div className="tnum shrink-0 text-xs text-text-secondary">
                    {s.scraped}/{s.found}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--text-primary)",
} as const;
