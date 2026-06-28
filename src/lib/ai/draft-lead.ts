import "server-only";
import type { DiscoveredBusiness } from "@/lib/types";
import { computeMissing } from "@/lib/leads/draft";
import { chat } from "./client";

export interface LeadDraft {
  candidate: DiscoveredBusiness;
  /** AI-suggested industry label (safe: never a contact fact). May be "". */
  industry: string;
  /** Blank contact fields the user should fill in. */
  missing: string[];
}

/**
 * Turn an OSM candidate into a draft lead. The AI ONLY suggests an industry
 * label from the public name/address — it never sees or writes phone, email, or
 * address, so it cannot fabricate contact details. If no AI key is configured
 * (or the call fails), we return the candidate unchanged with no industry guess.
 */
export async function draftLeadFromCandidate(candidate: DiscoveredBusiness): Promise<LeadDraft> {
  const missing = computeMissing(candidate);
  let industry = "";
  try {
    industry = await guessIndustry(candidate);
  } catch {
    industry = ""; // fallback: no key / model error — leave for the user
  }
  return { candidate, industry, missing };
}

async function guessIndustry(c: DiscoveredBusiness): Promise<string> {
  const prompt =
    `Given this business name and address, reply with ONLY a short industry ` +
    `label (2-4 words, e.g. "Plumbing", "Italian Restaurant", "Auto Repair"). ` +
    `No punctuation, no explanation.\n` +
    `Name: ${c.name}\nAddress: ${c.address || "(unknown)"}`;
  const out = await chat(prompt, { temperature: 0, maxTokens: 16 });
  return out.replace(/["\n.]/g, "").trim().slice(0, 40);
}
