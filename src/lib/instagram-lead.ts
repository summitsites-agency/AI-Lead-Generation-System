import "server-only";
import type { Lead } from "@/lib/types";
import {
  normalizeHandle,
  profileUrl,
  scrapeInstagramProfile,
  extractContactFromBio,
  type InstagramProfile,
  type InstagramManualInput,
} from "@/lib/scraping/instagram";
import { analyzeInstagram } from "@/lib/ai/instagram";
import { priorityFromScore } from "@/lib/scoring";
import { upsertLead, type NewLead } from "@/lib/db/leads";

export type InstagramLeadResult =
  | { ok: true; lead: Lead }
  | { ok: false; blocked: true; handle: string }
  | { ok: false; error: string };

function profileFromManual(handle: string, m: InstagramManualInput): InstagramProfile {
  const bio = m.bio ?? "";
  const contact = extractContactFromBio(bio);
  return {
    handle,
    url: profileUrl(handle),
    ok: true,
    name: `@${handle}`,
    followers: m.followers ?? null,
    following: null,
    posts: m.posts ?? null,
    bio,
    externalUrl: null,
    avatar: null,
    email: contact.email,
    phone: contact.phone,
  };
}

/**
 * Turn an Instagram handle/URL into a stored Social lead with a full rundown.
 * Tries to read the public profile; if that's blocked and no manual details
 * were supplied, returns `blocked` so the UI can ask the user to fill them in.
 */
export async function analyzeInstagramLead(
  input: string,
  manual?: InstagramManualInput
): Promise<InstagramLeadResult> {
  const handle = normalizeHandle(input);
  if (!handle) return { ok: false, error: "Enter a valid Instagram username, e.g. @joescoffee" };

  let profile: InstagramProfile;
  if (manual) {
    profile = profileFromManual(handle, manual);
  } else {
    profile = await scrapeInstagramProfile(handle);
    if (!profile.ok) return { ok: false, blocked: true, handle };
  }

  const a = await analyzeInstagram(profile);
  const lead: NewLead = {
    name: profile.name || `@${handle}`,
    website: profileUrl(handle),
    phone: profile.phone || "",
    email: profile.email || "",
    address: "",
    industry: manual?.niche?.trim() || "",
    location: "",
    source: "instagram",
    design_score: a.design_score,
    seo_score: a.seo_score,
    conversion_score: a.conversion_score,
    lead_score: a.lead_score,
    priority: priorityFromScore(a.lead_score),
    status: "new",
    ai_summary: a.summary,
    issues: a.issues,
    opportunities: a.opportunities,
    engine: a.engine,
    web_presence: "social",
    meta: {
      instagram: {
        followers: profile.followers,
        following: profile.following,
        posts: profile.posts,
        bio: profile.bio,
        avatar: profile.avatar,
        externalUrl: profile.externalUrl,
      },
    },
  };
  return { ok: true, lead: await upsertLead(lead) };
}
