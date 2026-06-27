import { NextRequest, NextResponse } from "next/server";
import { analyzeInstagramLead } from "@/lib/instagram-lead";
import type { InstagramManualInput } from "@/lib/scraping/instagram";

// Playwright fallback + AI call: Node runtime, never statically optimized.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/instagram — analyze an Instagram handle into a Social lead.
 * Body: { handle: string, manual?: { followers, posts, bio, niche } }
 * Returns { lead } on success, { blocked: true, handle } when the profile
 * can't be read automatically, or { error } for bad input.
 */
export async function POST(req: NextRequest) {
  let body: { handle?: string; manual?: InstagramManualInput };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const input = (body.handle ?? "").trim();
  if (!input) return NextResponse.json({ error: "handle required" }, { status: 400 });

  const result = await analyzeInstagramLead(input, body.manual);
  if (result.ok) return NextResponse.json({ lead: result.lead });
  if ("blocked" in result) return NextResponse.json({ blocked: true, handle: result.handle });
  return NextResponse.json({ error: result.error }, { status: 400 });
}
