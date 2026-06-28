import type { NewLead } from "@/lib/db/leads";
import type { WebPresence } from "@/lib/web-presence";
import { classifyWebPresence } from "@/lib/web-presence";
import { priorityFromScore } from "@/lib/scoring";
import { leadKeyFor } from "./draft";

export interface ManualLeadInput {
  name: string;
  city: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  industry: string;
}

/**
 * Assemble a NewLead row from a confirmed manual-lookup draft. Pure (no DB) so
 * the keying and scoring rules are unit-testable. Businesses with no real
 * website score as prime new-build leads, matching the discovery pipeline.
 */
export function buildManualLead(input: ManualLeadInput): NewLead {
  const presence = classifyWebPresence(input.website);
  const { score, issues, opportunities, summary } = analysisFor(presence);

  return {
    name: input.name.trim() || "Unknown",
    website: leadKeyFor(input.website, input.name, input.city),
    phone: input.phone.trim(),
    email: input.email.trim(),
    address: input.address.trim(),
    industry: input.industry.trim(),
    location: input.city.trim(),
    source: "manual-lookup",
    design_score: 1,
    seo_score: 1,
    conversion_score: 1,
    lead_score: score,
    priority: priorityFromScore(score),
    status: "new",
    ai_summary: summary,
    issues,
    opportunities,
    engine: "fallback",
    web_presence: presence,
  };
}

function analysisFor(presence: WebPresence): {
  score: number;
  issues: string[];
  opportunities: string[];
  summary: string;
} {
  if (presence === "site") {
    return {
      score: 50,
      issues: ["Added manually — site not yet analyzed"],
      opportunities: ["Run a full scan to score their existing website"],
      summary: "Added by company-name lookup. Existing website not analyzed yet.",
    };
  }
  if (presence === "social" || presence === "directory") {
    const kind = presence === "social" ? "social page" : "directory listing";
    return {
      score: 85,
      issues: [`Relies on a ${kind} instead of a real website`],
      opportunities: ["Build a dedicated website they own and control"],
      summary: `This business runs on a ${kind} with no real website — a strong candidate for a new build.`,
    };
  }
  return {
    score: 92,
    issues: ["No website found for this business"],
    opportunities: [
      "Build a modern website from scratch",
      "Capture leads they're currently losing to competitors online",
    ],
    summary: "No website detected — a prime candidate for a brand-new site.",
  };
}
