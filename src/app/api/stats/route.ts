import { NextResponse } from "next/server";
import { getStats } from "@/lib/db/leads";
import { recentScans } from "@/lib/db/jobs";
import { safeRoute } from "@/lib/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = safeRoute(async () => {
  return NextResponse.json({ stats: await getStats(), recentScans: await recentScans(6) });
});
