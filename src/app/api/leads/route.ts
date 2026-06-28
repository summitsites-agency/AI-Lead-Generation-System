import { NextRequest, NextResponse } from "next/server";
import { listLeads, type LeadFilter } from "@/lib/db/leads";
import { safeRoute } from "@/lib/route";
import type { LeadStatus, Priority } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = safeRoute(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const filter: LeadFilter = {
    priority: (sp.get("priority") as Priority) || undefined,
    status: (sp.get("status") as LeadStatus) || undefined,
    industry: sp.get("industry") || undefined,
    search: sp.get("search") || undefined,
    sort: (sp.get("sort") as LeadFilter["sort"]) || "score",
    hideDisqualified: sp.get("hideDisqualified") === "1",
    presence: (sp.get("presence") as LeadFilter["presence"]) || undefined,
  };
  return NextResponse.json({ leads: await listLeads(filter) });
});
