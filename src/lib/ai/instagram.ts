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

  return `This business runs on Instagram and has no real website. You are preparing a web design agency (Summit Sites) to reach out and convince them to get a website built. Return JSON ONLY with this exact shape:
{
  "design_score": 1-10,
  "seo_score": 1-10,
  "conversion_score": 1-10,
  "issues": [],
  "opportunities": [],
  "summary": "",
  "lead_score": 0-100
}

Guidance:
- design_score / seo_score / conversion_score reflect their CURRENT online setup with only Instagram (these will be low; an Instagram-only business typically has weak SEO and conversion).
- "issues" = concrete things they lose by having no website (e.g. invisible on Google search, renting their audience from the algorithm, no way to capture leads/emails, link-in-bio bottleneck, no online booking/store, no credibility for larger clients). Make them specific to this profile where possible.
- "opportunities" = persuasive talking points the agency can use to convince THIS business they need a website.
- "summary" = a short rundown the salesperson can read before contacting them: who they are, their size/reach, and the one-line pitch angle.
- "lead_score" = how big an opportunity this is for the agency (Instagram-only businesses are strong leads; 75-95).

Profile:
${facts}`;
}

/** Deterministic rundown used when no AI key is set or the call fails. */
function ruleAnalysis(p: InstagramProfile): Analysis {
  const reach =
    p.followers != null ? `about ${p.followers.toLocaleString("en-US")} followers` : "an engaged following";
  return {
    design_score: 3,
    seo_score: 1,
    conversion_score: 2,
    issues: [
      "Invisible on Google — customers searching for this service won't find them",
      "Rents its audience from Instagram's algorithm instead of owning it",
      "No website to capture leads, emails, bookings or orders",
      p.externalUrl
        ? "Everything funnels through a single link-in-bio bottleneck"
        : "No link in bio — no path from Instagram to a real next step",
    ],
    opportunities: [
      `They've already built ${reach} on Instagram — a website turns that attention into searchable, ownable business`,
      "A simple site adds Google visibility, a booking/contact form, and credibility they can't get from a profile",
      "Position the website as the home base their Instagram points to — low effort for them, big upside",
    ],
    summary: `@${p.handle}${p.name && p.name !== `@${p.handle}` ? ` (${p.name})` : ""} runs on Instagram with ${reach} and no real website. Strong new-build lead: lead with the fact that they're invisible on Google and don't own their audience.`,
    lead_score: 88,
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
      lead_score: clamp(Math.round(parsed.lead_score), 0, 100),
      engine: "ai",
    };
  } catch (e) {
    console.error("[instagram] AI failed, using fallback:", e instanceof Error ? e.message : e);
    return ruleAnalysis(profile);
  }
}
