import { NextRequest } from "next/server";
import { lookupByName } from "@/lib/scraping/lookup";
import { draftLeadFromCandidate } from "@/lib/ai/draft-lead";
import { buildManualLead, type ManualLeadInput } from "@/lib/leads/manual";
import { upsertLead } from "@/lib/db/leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * POST /api/leads/lookup
 *   { action: "search", name, city } → { candidates, industries, missing }
 *   { action: "save", lead: ManualLeadInput } → { lead }
 *
 * Lets the user add a lead from just a company name. Search uses OpenStreetMap
 * (no browser) to find real contact data; save persists a confirmed draft.
 */
export async function POST(req: NextRequest) {
  let body: { action?: string; name?: string; city?: string; lead?: ManualLeadInput };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid JSON body" }, 400);
  }

  if (body.action === "save") {
    if (!body.lead?.name?.trim()) return json({ error: "lead name is required" }, 400);
    if (!body.lead?.city?.trim()) return json({ error: "city is required" }, 400);
    const lead = await upsertLead(buildManualLead(body.lead));
    return json({ lead });
  }

  // default: search
  const name = (body.name ?? "").trim();
  const city = (body.city ?? "").trim();
  if (!name) return json({ error: "company name is required" }, 400);
  if (!city) return json({ error: "city is required" }, 400);

  let candidates;
  try {
    candidates = await lookupByName(name, city);
  } catch {
    return json({ error: "Lookup service is unavailable. Try again or enter details manually." }, 502);
  }

  // Enrich each candidate with an AI industry guess + gap list (best effort).
  const drafts = await Promise.all(candidates.map((c) => draftLeadFromCandidate(c)));
  return json({
    candidates: drafts.map((d) => ({
      ...d.candidate,
      industry: d.industry,
      missing: d.missing,
    })),
  });
}
