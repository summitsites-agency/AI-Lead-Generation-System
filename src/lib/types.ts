// Shared domain types for the lead-generation pipeline.

import type { WebPresence } from "@/lib/web-presence";

export type Priority = "HIGH" | "MEDIUM" | "LOW";

export type LeadStatus =
  | "new"
  | "contacted"
  | "responded"
  | "won"
  | "lost"
  | "not_a_lead";

export type OutreachType = "email" | "sms" | "followup";

export type AiProvider = "groq" | "gemini" | "openrouter";

/** A business discovered by the lead-discovery sources, before website analysis. */
export interface DiscoveredBusiness {
  name: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  source: string;
  /** Google rating 0–5, when the source provides it. */
  rating?: number | null;
  /** Number of ratings/reviews, when the source provides it. */
  reviewCount?: number | null;
  /** Facebook page data, when discovered via the Facebook source. */
  facebook?: FacebookMeta;
}

/** Raw signals extracted from a business's website. */
export interface SiteSignals {
  url: string;
  ok: boolean;
  /** error message when the fetch/parse failed */
  error?: string;
  statusCode?: number;
  title: string;
  metaDescription: string;
  text: string;
  headings: string[];
  ctaCount: number;
  formCount: number;
  hasContactPage: boolean;
  hasContactInfo: boolean;
  hasViewportMeta: boolean;
  /** best-effort contact email found on the page, if any */
  contactEmail?: string;
  /** time to download the HTML, ms */
  loadMs: number;
  bytes: number;
  /** Detected site builder / CMS (e.g. "Wix", "WordPress"), or null. */
  builder?: string | null;
}

/** Structured analysis returned by the AI module (or the rule-based fallback). */
export interface Analysis {
  design_score: number; // 1-10
  seo_score: number; // 1-10
  conversion_score: number; // 1-10
  issues: string[];
  opportunities: string[];
  summary: string;
  lead_score: number; // 0-100
  /** "ai" when produced by an LLM, "fallback" when produced by the rule engine */
  engine: "ai" | "fallback";
}

/** Snapshot of a scraped Instagram profile, kept for the preview card. */
export interface InstagramMeta {
  followers: number | null;
  following: number | null;
  posts: number | null;
  bio: string;
  avatar: string | null;
  externalUrl: string | null;
}

/** Public data read from a Facebook business page. */
export interface FacebookMeta {
  /** the Facebook page URL (also stored as the lead's `website`) */
  pageUrl: string;
  /** page category as shown on Facebook, best-effort ("" if unknown) */
  category: string;
  /** the business's real website if one was found on the page, else null */
  website: string | null;
}

/** Extra structured data attached to a lead (IG profile snapshot, FB page data). */
export interface LeadMeta {
  instagram?: InstagramMeta;
  facebook?: FacebookMeta;
}

export interface Lead {
  id: number;
  name: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  industry: string;
  location: string;
  source: string;
  design_score: number;
  seo_score: number;
  conversion_score: number;
  lead_score: number;
  priority: Priority;
  status: LeadStatus;
  ai_summary: string;
  issues: string[];
  opportunities: string[];
  engine: "ai" | "fallback";
  /** Google rating 0–5, or null when unknown. */
  rating: number | null;
  /** Number of reviews, or null when unknown. */
  review_count: number | null;
  /** Business-value score 0–100 (reviews × rating, baseline 50 when unknown). */
  value_score: number;
  /** Detected site builder / CMS, or null. */
  builder: string | null;
  /** what kind of web presence the business has (drives the new-build section) */
  web_presence: WebPresence;
  /** true once the user manually set the priority — protects it from re-scoring */
  priority_locked: boolean;
  /** extra structured data (e.g. the Instagram profile snapshot), or null */
  meta: LeadMeta | null;
  created_at: string;
}

export interface OutreachMessage {
  id: number;
  lead_id: number;
  type: OutreachType;
  message: string;
  sent: boolean;
  created_at: string;
}

export type ScanStatus = "running" | "done" | "error";

export interface ScanJob {
  id: number;
  industry: string;
  location: string;
  status: ScanStatus;
  found: number;
  scraped: number;
  failed: number;
  created_at: string;
}

/** A single line emitted to the live scan log (streamed to the scraper UI). */
export interface ScanEvent {
  type: "log" | "progress" | "lead" | "done" | "error";
  message?: string;
  level?: "info" | "success" | "warn" | "error";
  /** progress 0..1 */
  progress?: number;
  found?: number;
  scraped?: number;
  failed?: number;
  lead?: Lead;
}
