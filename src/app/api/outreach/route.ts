import { NextRequest, NextResponse } from "next/server";
import { getLead } from "@/lib/db/leads";
import { generateOutreach } from "@/lib/ai/outreach";
import { saveOutreach, listOutreach } from "@/lib/db/outreach";
import type { OutreachType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: OutreachType[] = ["email", "sms", "followup"];

/** POST /api/outreach { leadId, type } — generate + persist one message. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { leadId?: number; type?: string };
  const lead = body.leadId ? await getLead(Number(body.leadId)) : null;
  if (!lead) return NextResponse.json({ error: "lead not found" }, { status: 404 });
  if (!body.type || !TYPES.includes(body.type as OutreachType)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }
  const type = body.type as OutreachType;
  const message = await generateOutreach(lead, type);
  const saved = await saveOutreach(lead.id, type, message);
  return NextResponse.json({ message: saved });
}

/** GET /api/outreach?leadId=123 — existing messages for a lead. */
export async function GET(req: NextRequest) {
  const leadId = Number(req.nextUrl.searchParams.get("leadId"));
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  return NextResponse.json({ outreach: await listOutreach(leadId) });
}
