import "server-only";
import type { SiteSignals } from "@/lib/types";
import { parseSignals } from "./parse";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function failed(url: string, error: string): SiteSignals {
  return {
    url,
    ok: false,
    error,
    title: "",
    metaDescription: "",
    text: "",
    headings: [],
    ctaCount: 0,
    formCount: 0,
    hasContactPage: false,
    hasContactInfo: false,
    hasViewportMeta: false,
    loadMs: 0,
    bytes: 0,
  };
}

async function fetchOnce(url: string): Promise<SiteSignals> {
  const started = Date.now();
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  const loadMs = Date.now() - started;
  if (!res.ok) {
    const s = failed(url, `HTTP ${res.status}`);
    s.statusCode = res.status;
    return s;
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("html") && !ct.includes("text")) {
    return failed(url, `unexpected content-type: ${ct.slice(0, 40)}`);
  }
  const html = await res.text();
  return parseSignals(html, url, loadMs);
}

/**
 * Scrape a single website into quality signals.
 * Retries once on failure (spec §10: "Timeout → retry once").
 */
export async function scrapeSite(url: string): Promise<SiteSignals> {
  try {
    return await fetchOnce(url);
  } catch (e) {
    try {
      return await fetchOnce(url);
    } catch (e2) {
      const msg = e2 instanceof Error ? e2.message : String(e2 ?? e);
      return failed(url, msg.includes("timeout") ? "timeout" : msg.slice(0, 120));
    }
  }
}
