"use client";

import { Users, Flame, Gauge, TrendingUp } from "lucide-react";
import type { Stats } from "@/lib/db/leads";
import { Card } from "@/components/ui";
import { fmt } from "@/lib/utils";

export function KpiCards({ stats, loading }: { stats?: Stats; loading?: boolean }) {
  const cards = [
    { label: "Total Leads", value: stats?.total, icon: Users, color: "var(--primary)" },
    { label: "High Priority", value: stats?.high, icon: Flame, color: "var(--danger)" },
    { label: "Avg Lead Score", value: stats?.avgScore, icon: Gauge, color: "var(--warning)" },
    {
      label: "Est. Conversions",
      value: stats?.estConversions,
      icon: TrendingUp,
      color: "var(--success)",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="card-glow p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs text-text-secondary">{c.label}</div>
              {loading ? (
                <div className="skeleton mt-2 h-7 w-16 rounded" />
              ) : (
                <div className="tnum mt-1 text-2xl font-semibold tracking-tight">
                  {fmt(c.value)}
                </div>
              )}
            </div>
            <div
              className="grid h-9 w-9 place-items-center rounded-lg"
              style={{ background: `color-mix(in srgb, ${c.color} 14%, transparent)`, color: c.color }}
            >
              <c.icon size={17} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
