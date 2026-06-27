import { NextRequest, NextResponse } from "next/server";
import { providerStatuses, PROVIDERS } from "@/lib/ai/config";
import { setSetting } from "@/lib/db/settings";
import type { AiProvider } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ providers: await providerStatuses() });
}

/** POST /api/settings { provider, model? } — switch the active AI provider. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { provider?: string; model?: string };
  if (!body.provider || !PROVIDERS.includes(body.provider as AiProvider)) {
    return NextResponse.json({ error: "invalid provider" }, { status: 400 });
  }
  await setSetting("ai_provider", body.provider);
  if (body.model && body.model.trim()) {
    await setSetting(`${body.provider}_model`, body.model.trim());
  }
  return NextResponse.json({ providers: await providerStatuses() });
}
