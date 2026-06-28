import { NextRequest, NextResponse } from "next/server";
import { getLead, updateLeadStatus, updateLeadPriority, deleteLead } from "@/lib/db/leads";
import { listOutreach } from "@/lib/db/outreach";
import { LEAD_STATUSES } from "@/lib/status";
import { safeRoute } from "@/lib/route";
import type { LeadStatus, Priority } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = LEAD_STATUSES;
const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "LOW"];

export const GET = safeRoute(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const lead = await getLead(Number(id));
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ lead, outreach: await listOutreach(lead.id) });
});

export const PATCH = safeRoute(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { status?: string; priority?: string };

  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(body.priority as Priority)) {
      return NextResponse.json({ error: "invalid priority" }, { status: 400 });
    }
    const lead = await updateLeadPriority(Number(id), body.priority as Priority);
    if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ lead });
  }

  if (!body.status || !STATUSES.includes(body.status as LeadStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  const lead = await updateLeadStatus(Number(id), body.status as LeadStatus);
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ lead });
});

export const DELETE = safeRoute(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const ok = await deleteLead(Number(id));
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
});
