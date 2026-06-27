import "server-only";
import type { Analysis } from "@/lib/types";
import type { InstagramProfile } from "@/lib/scraping/instagram";
import { chat } from "./client";
import { ANALYSIS_SCHEMA, extractJson } from "./analyze";
import { clamp } from "@/lib/scoring";

const SYSTEM =
  "You are a senior web strategist who helps local businesses that rely only on Instagram understand why owning a real website would win them more customers. Return JSON only.";

function fmt(n: number | null): string {
  return n == null ? "unknown" : n.toLocaleString("en-US");
}

function buildPrompt(p: InstagramProfile): string {
  const facts = [
    `Instagram handle: @${p.handle}`,
    `Display name: ${p.name}`,
    `Followers: ${fmt(p.followers)}`,
    `Following: ${fmt(p.following)}`,
    `Posts: ${fmt(p.posts)}`,
    `Bio: ${p.bio || "(none captured)"}`,
    `Link in bio: ${p.externalUrl ? p.externalUrl : "none detected"}`,
    `Has its own website: NO (Instagram-only business)`,
  ].join("\n");

  return `You are preparing a web design agency (Summit Sites) to reach out to the Instagram business below and convince them to get their own website. Write everything SPECIFIC to THIS business, using the data provided — tie each point to their actual size, niche, or bio. Do NOT output a generic checklist.

BE ACCURATE — this matters:
- Do NOT claim they are "invisible on Google" or "can't be found online." Many Instagram businesses already rank on Google through a Google Business Profile, and their Instagram itself ranks for their name. Saying otherwise is false and will embarrass the salesperson.
- Focus on what is genuinely true for a business with no website of its own:
  * They don't OWN their web presence — they rent it from Instagram's algorithm and could lose it.
  * They can't rank in Google for the services/products people actually search for (only their brand name).
  * No website to capture leads, take bookings, sell directly, or build an email list.
  * Everything funnels through a single link in bio.
  * A real site builds trust with larger or commercial clients.

Return JSON ONLY with this exact shape:
{
  "design_score": 1-10,
  "seo_score": 1-10,
  "conversion_score": 1-10,
  "issues": [],
  "opportunities": [],
  "summary": "",
  "lead_score": 0-100
}

- design_score / seo_score / conversion_score: rate their CURRENT setup with only Instagram (usually low for SEO/conversion).
- "issues": the specific gaps THIS business has by relying only on Instagram.
- "opportunities": specific, persuasive talking points to convince THIS business to get a website.
- "summary": a short rundown the salesperson reads before reaching out — who they are, their reach, and the angle.
- "lead_score": estimate the opportunity size (it will be recomputed from their reach).

Profile:
${facts}`;
}

/**
 * Opportunity score driven by reach: a larger audience with no website is a
 * bigger opportunity (more to gain, more credible business). Deterministic so
 * scores actually vary instead of the model anchoring everything at one value.
 */
function opportunityScore(p: InstagramProfile): number {
  const f = p.followers;
  let score: number;
  if (f == null) score = 80;
  else if (f < 500) score = 72;
  else if (f < 2_000) score = 78;
  else if (f < 10_000) score = 84;
  else if (f < 50_000) score = 90;
  else score = 95;
  // Already funneling through a link in bio (maybe a booking tool) — slightly smaller gap.
  if (p.externalUrl) score -= 4;
  return clamp(score, 0, 100);
}

/** Deterministic rundown used when no AI key is set or the call fails. */
function ruleAnalysis(p: InstagramProfile): Analysis {
  const reach =
    p.followers != null ? `about ${p.followers.toLocaleString("en-US")} followers` : "an engaged following";
  return {
    design_score: 3,
    seo_score: 2,
    conversion_score: 2,
    issues: [
      "Doesn't own its web presence — it's rented from Instagram's algorithm",
      "Can't rank in Google for the services or products customers search for (only the business name)",
      "No website to capture leads, take bookings, or sell directly",
      p.externalUrl
        ? "Everything funnels through a single link in bio"
        : "No link in bio — nowhere to send interested customers",
    ],
    opportunities: [
      `They've built ${reach} on Instagram — a website turns that rented attention into an asset they own`,
      "A simple site adds Google visibility for their services, a booking/contact form, and credibility with bigger clients",
      "Position the website as the home base their Instagram points to — low lift for them, clear upside",
    ],
    summary: `@${p.handle}${p.name && p.name !== `@${p.handle}` ? ` (${p.name})` : ""} runs on Instagram with ${reach} and no website of their own. Strong lead: they don't own their audience and can't be found in Google for what they actually sell.`,
    lead_score: opportunityScore(p),
    engine: "fallback",
  };
}

/**
 * Produce a full Instagram "rundown" in the standard Analysis shape, so it
 * renders in the existing lead drawer. Falls back to a rule-based rundown when
 * the AI call is unavailable.
 */
export async function analyzeInstagram(profile: InstagramProfile): Promise<Analysis> {
  try {
    const raw = await chat(buildPrompt(profile), { system: SYSTEM, json: true, temperature: 0.4 });
    const parsed = ANALYSIS_SCHEMA.parse(extractJson(raw));
    return {
      design_score: clamp(Math.round(parsed.design_score), 1, 10),
      seo_score: clamp(Math.round(parsed.seo_score), 1, 10),
      conversion_score: clamp(Math.round(parsed.conversion_score), 1, 10),
      issues: parsed.issues.slice(0, 12),
      opportunities: parsed.opportunities.slice(0, 12),
      summary: parsed.summary.slice(0, 800),
      // Authoritative score comes from reach, not the model (keeps scores varied).
      lead_score: opportunityScore(profile),
      engine: "ai",
    };
  } catch (e) {
    console.error("[instagram] AI failed, using fallback:", e instanceof Error ? e.message : e);
    return ruleAnalysis(profile);
  }
}
