import "server-only";
import { z } from "zod";
import type { Analysis, SiteSignals } from "@/lib/types";
import { chat } from "./client";
import { analyzeWithRules } from "./fallback";
import { clamp } from "@/lib/scoring";

export const ANALYSIS_SCHEMA = z.object({
  design_score: z.coerce.number(),
  seo_score: z.coerce.number(),
  conversion_score: z.coerce.number(),
  issues: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  summary: z.string().default(""),
  lead_score: z.coerce.number(),
});

const SYSTEM = "You are a senior conversion rate optimization expert. Return JSON only.";

function buildPrompt(s: SiteSignals): string {
  const facts = [
    `URL: ${s.url}`,
    `Title: ${s.title || "(none)"}`,
    `Meta description: ${s.metaDescription || "(none)"}`,
    `Headings: ${s.headings.slice(0, 25).join(" | ") || "(none)"}`,
    `Detected CTAs: ${s.ctaCount}`,
    `Forms: ${s.formCount}`,
    `Has contact info/page: ${s.hasContactInfo || s.hasContactPage}`,
    `Mobile viewport tag: ${s.hasViewportMeta}`,
    `Load time: ${s.loadMs}ms`,
    `Visible text (truncated):`,
    s.text.replace(/\s+/g, " ").slice(0, 6000),
  ].join("\n");

  return `Analyze the website content and return JSON ONLY with this exact shape:
{
  "design_score": 1-10,
  "seo_score": 1-10,
  "conversion_score": 1-10,
  "issues": [],
  "opportunities": [],
  "summary": "",
  "lead_score": 0-100
}

Scoring guidance (lead_score = how big an opportunity this is for a web design agency; a worse site = HIGHER lead_score):
- Missing CTA -> +20
- No contact info -> +20
- Weak SEO -> +15
- Poor mobile experience -> +20
- Outdated design -> +25
Bands: 0-40 low priority, 41-70 medium, 71-100 high priority.

Website Content:
${facts}`;
}

/** Pull the first JSON object out of a model response (handles code fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("no JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * AI website analysis with graceful fallback. Always returns a valid Analysis:
 * uses the LLM when a key is configured and the call succeeds, otherwise the
 * deterministic rule engine.
 */
export async function analyzeSite(signals: SiteSignals): Promise<Analysis> {
  if (!signals.ok) return analyzeWithRules(signals);

  try {
    const raw = await chat(buildPrompt(signals), { system: SYSTEM, json: true, temperature: 0.3 });
    const parsed = ANALYSIS_SCHEMA.parse(extractJson(raw));
    return {
      design_score: clamp(Math.round(parsed.design_score), 1, 10),
      seo_score: clamp(Math.round(parsed.seo_score), 1, 10),
      conversion_score: clamp(Math.round(parsed.conversion_score), 1, 10),
      issues: parsed.issues.slice(0, 12),
      opportunities: parsed.opportunities.slice(0, 12),
      summary: parsed.summary.slice(0, 600),
      lead_score: clamp(Math.round(parsed.lead_score), 0, 100),
      engine: "ai",
    };
  } catch (e) {
    // No key, rate-limited, malformed JSON, timeout — fall back to rules.
    console.error("[analyze] AI failed, using fallback:", e instanceof Error ? e.message : e);
    return analyzeWithRules(signals);
  }
}
