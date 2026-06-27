import type { Analysis, SiteSignals } from "@/lib/types";
import { clamp } from "@/lib/scoring";

/**
 * Deterministic, no-LLM analysis. Produces the same Analysis shape an AI would,
 * derived purely from scraped signals using the risk weights in spec §2.3:
 *   missing CTA +20 · no contact +20 · weak SEO +15 · poor mobile +20 · outdated +25
 *
 * Higher lead_score = bigger opportunity (worse website = better lead).
 */
export function analyzeWithRules(s: SiteSignals): Analysis {
  // Unreachable / broken site is a strong opportunity for an agency.
  if (!s.ok) {
    return {
      design_score: 1,
      seo_score: 1,
      conversion_score: 1,
      issues: [
        s.error
          ? `Website failed to load (${s.error})`
          : "Website failed to load — appears broken or offline",
      ],
      opportunities: [
        "Rebuild on a fast, reliable modern stack",
        "Establish a working web presence with lead capture",
      ],
      summary: "The site could not be reached, which is a major liability and a clear opportunity.",
      lead_score: 80,
      engine: "fallback",
    };
  }

  const textLen = s.text.trim().length;
  const issues: string[] = [];
  const opportunities: string[] = [];

  // ── risk detection ───────────────────────────────────────────────────────────
  const missingCta = s.ctaCount === 0;
  const noContact = !s.hasContactInfo && !s.hasContactPage;
  const weakSeo =
    !s.title || s.title.length < 10 || !s.metaDescription || s.headings.length === 0;
  const poorMobile = !s.hasViewportMeta;
  const outdated = s.loadMs > 4000 || (s.formCount === 0 && s.ctaCount === 0) || textLen < 400;

  let risk = 0;
  if (missingCta) {
    risk += 20;
    issues.push("No clear call-to-action found");
    opportunities.push("Add prominent CTAs (call, quote, book) above the fold");
  }
  if (noContact) {
    risk += 20;
    issues.push("No contact details or contact page detected");
    opportunities.push("Surface phone/email and add a contact form to capture leads");
  }
  if (weakSeo) {
    risk += 15;
    issues.push("Weak on-page SEO (missing title, meta description, or headings)");
    opportunities.push("Optimize title, meta description and heading structure");
  }
  if (poorMobile) {
    risk += 20;
    issues.push("No responsive viewport — likely poor on mobile");
    opportunities.push("Make the site mobile-responsive");
  }
  if (outdated) {
    risk += 25;
    issues.push("Design appears thin or outdated (little content, slow, or static)");
    opportunities.push("Modernize the design and improve page performance");
  }

  const lead_score = clamp(risk, 0, 100);

  // ── 1–10 sub-scores (10 = excellent, low = needs work) ─────────────────────────
  let seo = 10;
  if (!s.title) seo -= 3;
  else if (s.title.length < 10) seo -= 1;
  if (!s.metaDescription) seo -= 2;
  if (s.headings.length === 0) seo -= 2;
  else if (s.headings.length < 3) seo -= 1;
  if (textLen < 400) seo -= 2;

  let conversion = 10;
  if (missingCta) conversion -= 3;
  if (noContact) conversion -= 3;
  if (s.formCount === 0) conversion -= 2;
  if (textLen < 400) conversion -= 1;

  let design = 10;
  if (poorMobile) design -= 3;
  if (s.loadMs > 4000) design -= 2;
  if (s.formCount === 0 && s.ctaCount === 0) design -= 2;
  if (s.bytes < 8000) design -= 1;
  if (textLen < 400) design -= 1;

  if (!issues.length) issues.push("No major issues detected by automated checks");
  if (!opportunities.length)
    opportunities.push("Run a manual review for finer optimization opportunities");

  const summary = buildSummary(lead_score, issues.length);

  return {
    design_score: clamp(design, 1, 10),
    seo_score: clamp(seo, 1, 10),
    conversion_score: clamp(conversion, 1, 10),
    issues,
    opportunities,
    summary,
    lead_score,
    engine: "fallback",
  };
}

function buildSummary(score: number, issueCount: number): string {
  if (score >= 71)
    return `High-opportunity lead: ${issueCount} significant website weakness(es) that an agency could readily improve.`;
  if (score >= 41)
    return `Moderate opportunity: ${issueCount} website issue(s) worth addressing.`;
  return "Lower priority: the site is reasonably solid with few obvious gaps.";
}
