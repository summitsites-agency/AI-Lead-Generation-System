import "server-only";
import type { Lead, OutreachType } from "@/lib/types";
import { chat } from "./client";
import { displayHost } from "@/lib/utils";

function buildPrompt(lead: Lead, type: OutreachType): string {
  const issues = lead.issues.length ? lead.issues.join("; ") : lead.ai_summary;
  const channel = type === "sms" ? "SMS" : type === "followup" ? "follow-up message" : "email";
  return `I build websites and I am contacting a lead. Draft a ${channel} using NEPQ. Keep it short.

NEPQ approach: stay calm and consultative, lead with curiosity, ask situation/problem-aware questions that get them to notice the gap themselves, no hype, no hard pitch, end with a soft low-pressure next step.

Business name: ${lead.name}
Website: ${lead.website}
Real issues I found on their site (weave in naturally, don't list them robotically): ${issues}

Plain text only, ready to send.${type === "email" ? ' Begin with one "Subject:" line.' : ""}`;
}

/** Templated fallback used when no AI key is configured / the call fails. */
function templateOutreach(lead: Lead, type: OutreachType): string {
  const host = displayHost(lead.website);
  const topIssue = lead.issues[0] ?? "a few things on the site that could convert better";
  const name = lead.name || "there";
  switch (type) {
    case "sms":
      return `Hi ${name}, this is Summit Sites — we build sites for local businesses. Noticed ${topIssue.toLowerCase()} on ${host}. Happy to share a quick free fix list if useful — want me to send it?`;
    case "followup":
      return `Hi ${name}, just circling back on my note about ${host}. No pressure at all — if improving ${topIssue.toLowerCase()} is on your radar this quarter, I'm glad to walk you through a couple of quick wins.`;
    default:
      return `Subject: A couple of quick wins for ${host}

Hi ${name},

I was looking at ${host} and noticed ${topIssue.toLowerCase()}${
        lead.issues[1] ? `, plus ${lead.issues[1].toLowerCase()}` : ""
      }. These are common and usually quick to fix, and they tend to cost local businesses real leads.

We help businesses like yours turn their site into a steady source of enquiries. If you're open to it, I can put together a short, no-obligation list of the highest-impact fixes for your site.

Would that be useful?

— Summit Sites`;
  }
}

/** Generate a single outreach message, falling back to a template on failure. */
export async function generateOutreach(lead: Lead, type: OutreachType): Promise<string> {
  try {
    const text = await chat(buildPrompt(lead, type), { temperature: 0.7, maxTokens: 500 });
    return text.trim() || templateOutreach(lead, type);
  } catch {
    return templateOutreach(lead, type);
  }
}
