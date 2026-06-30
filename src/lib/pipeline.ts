import "server-only";
import type {
  Analysis,
  DiscoveredBusiness,
  Lead,
  ScanEvent,
  SiteSignals,
} from "@/lib/types";
import { defaultSources, runSourceChain } from "@/lib/scraping/sources";
import { parseImport } from "@/lib/scraping/csv";
import { scrapeSite } from "@/lib/scraping/site";
import { analyzeSite } from "@/lib/ai/analyze";
import { analyzeWithRules } from "@/lib/ai/fallback";
import { priorityFromScore, valueScore } from "@/lib/scoring";
import { classifyWebPresence, type WebPresence } from "@/lib/web-presence";
import { normalizeUrl, canonicalUrl, slug } from "@/lib/utils";
import { upsertLead, type NewLead } from "@/lib/db/leads";
import { createScanJob, updateScanJob, finishScanJob } from "@/lib/db/jobs";

export interface ScanRequest {
  mode: "discover" | "import";
  industry?: string;
  location?: string;
  importText?: string;
  limit?: number;
}

type Emit = (e: ScanEvent) => void;

/** Run a full scan, emitting live events. Resolves when complete. */
export async function runScan(req: ScanRequest, emit: Emit): Promise<void> {
  const industry = (req.industry ?? "").trim();
  const location = (req.location ?? "").trim();
  const jobId = await createScanJob(industry, location);

  try {
    const businesses = await discover(req, industry, location, emit);
    const unique = dedupeBusinesses(businesses);
    emit({ type: "progress", found: unique.length, scraped: 0, failed: 0, progress: 0 });
    await updateScanJob(jobId, { found: unique.length });

    if (!unique.length) {
      emit({ type: "log", level: "warn", message: "No businesses found for that search." });
      await finishScanJob(jobId, "done");
      emit({ type: "done", found: 0, scraped: 0, failed: 0 });
      return;
    }

    let analyzed = 0; // reachable sites we actually analyzed
    let noSite = 0; // no website / unreachable / social-only — still strong leads
    let finished = 0; // total processed (drives the progress bar, always ≤ found)
    const concurrency = clampInt(process.env.SCRAPE_CONCURRENCY, 6, 1, 12);

    await mapPool(unique, concurrency, async (biz) => {
      try {
        const { lead, reachable } = await processBusiness(biz, industry, location, emit);
        if (reachable) analyzed++;
        else noSite++;
        emit({ type: "lead", lead });
      } catch (e) {
        noSite++;
        const msg = e instanceof Error ? e.message : String(e);
        emit({ type: "log", level: "error", message: `Failed: ${biz.name} — ${msg}` });
      } finally {
        finished++;
        emit({
          type: "progress",
          found: unique.length,
          scraped: analyzed,
          failed: noSite,
          progress: finished / unique.length,
        });
      }
    });

    await updateScanJob(jobId, { scraped: analyzed, failed: noSite });
    await finishScanJob(jobId, "done");
    emit({
      type: "log",
      level: "success",
      message: `Done. ${analyzed} site(s) analyzed, ${noSite} with no usable website (prime new-build leads).`,
    });
    emit({ type: "done", found: unique.length, scraped: analyzed, failed: noSite });
  } catch (e) {
    await finishScanJob(jobId, "error");
    const msg = e instanceof Error ? e.message : String(e);
    emit({ type: "error", level: "error", message: msg });
  }
}

async function discover(
  req: ScanRequest,
  industry: string,
  location: string,
  emit: Emit
): Promise<DiscoveredBusiness[]> {
  if (req.mode === "import") {
    const list = parseImport(req.importText ?? "");
    emit({ type: "log", message: `Imported ${list.length} business(es) from your list.` });
    return list;
  }

  return runSourceChain(defaultSources(), industry, location, {
    limit: req.limit,
    onLog: (message, level) => emit({ type: "log", message, level }),
  });
}

async function processBusiness(
  biz: DiscoveredBusiness,
  industry: string,
  location: string,
  emit: Emit
): Promise<{ lead: Lead; reachable: boolean }> {
  const presence = classifyWebPresence(biz.website);

  // Businesses with no website are prime web-agency leads, but there's nothing
  // to scrape — assign a fixed high-opportunity analysis.
  if (presence === "none") {
    emit({ type: "log", message: `${biz.name}: no website — flagging as top opportunity.` });
    const lead = await store(
      biz,
      `nowebsite://${slug(biz.name)}`,
      industry,
      location,
      biz.source,
      noWebsiteAnalysis(),
      "none"
    );
    return { lead, reachable: false };
  }

  // Social- or directory-only presence (Instagram, Yelp, etc.) — no real website.
  // Keep the actual URL so we can link straight to their page for research.
  if (presence === "social" || presence === "directory") {
    const kind = presence === "social" ? "social page" : "directory listing";
    emit({ type: "log", message: `${biz.name}: ${kind} only — flagging as top opportunity.` });
    const url = canonicalUrl(biz.website) || normalizeUrl(biz.website) || biz.website;
    const lead = await store(
      biz,
      url,
      industry,
      location,
      biz.source,
      noRealSiteAnalysis(url, presence),
      presence
    );
    return { lead, reachable: false };
  }

  emit({ type: "log", message: `Scraping ${biz.name}…` });
  const signals: SiteSignals = await scrapeSite(biz.website);
  const analysis = await analyzeSite(signals).catch(() => analyzeWithRules(signals));
  const email = biz.email || signals.contactEmail || "";
  const website = canonicalUrl(biz.website) || biz.website;
  const lead = await store(
    biz,
    website,
    industry,
    location,
    biz.source,
    analysis,
    "site",
    email,
    signals.builder ?? null
  );
  return { lead, reachable: signals.ok };
}

/** Fixed high-opportunity analysis for a social- or directory-only business. */
function noRealSiteAnalysis(url: string, presence: "social" | "directory"): Analysis {
  const fallback = presence === "social" ? "social media" : "directory listing";
  let platform = fallback;
  try {
    platform = new URL(url).hostname.replace(/^www\.|^m\./, "").split(".")[0];
  } catch {
    /* keep default */
  }
  const kind = presence === "social" ? `${platform} page` : `${platform} listing`;
  return {
    design_score: 2,
    seo_score: 1,
    conversion_score: 2,
    issues: [
      `Relies on a ${kind} instead of a real website`,
      "No owned domain, weak search visibility, limited lead capture",
    ],
    opportunities: [
      "Build a dedicated website they own and control",
      `Add SEO, lead forms and analytics they can't get from a ${
        presence === "social" ? "social page" : "listing"
      }`,
    ],
    summary: `This business runs on a ${kind} with no real website — a strong candidate for a new build.`,
    lead_score: 85,
    engine: "fallback",
  };
}

async function store(
  biz: DiscoveredBusiness,
  website: string,
  industry: string,
  location: string,
  source: string,
  a: Analysis,
  presence: WebPresence,
  email = "",
  builder: string | null = null
): Promise<Lead> {
  const rating = biz.rating ?? null;
  const reviewCount = biz.reviewCount ?? null;
  const lead: NewLead = {
    name: biz.name || website,
    website,
    phone: biz.phone || "",
    email: email || biz.email || "",
    address: biz.address || "",
    industry,
    location,
    source,
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
    web_presence: presence,
    rating,
    review_count: reviewCount,
    value_score: valueScore(rating, reviewCount, builder),
    builder,
  };
  return upsertLead(lead);
}

function noWebsiteAnalysis(): Analysis {
  return {
    design_score: 1,
    seo_score: 1,
    conversion_score: 1,
    issues: ["No website found for this business"],
    opportunities: [
      "Build a modern website from scratch",
      "Capture leads they're currently losing to competitors online",
    ],
    summary: "No website detected — a prime candidate for a brand-new site.",
    lead_score: 92,
    engine: "fallback",
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function dedupeBusinesses(list: DiscoveredBusiness[]): DiscoveredBusiness[] {
  const seen = new Set<string>();
  return list.filter((b) => {
    // Canonicalize the website so URL-form variants collapse to one key; for
    // businesses with no website, fall back to phone (most reliable identity),
    // then the name slug.
    const key = b.website
      ? canonicalUrl(b.website)
      : b.phone
        ? `phone:${b.phone.replace(/\D/g, "")}`
        : `name:${slug(b.name)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clampInt(v: string | undefined, def: number, lo: number, hi: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}
