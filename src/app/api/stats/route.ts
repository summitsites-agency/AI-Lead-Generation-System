import { NextResponse } from "next/server";
import { getStats } from "@/lib/db/leads";
import { recentScans } from "@/lib/db/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ stats: await getStats(), recentScans: await recentScans(6) });
}
