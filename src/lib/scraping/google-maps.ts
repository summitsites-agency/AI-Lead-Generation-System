import "server-only";
import { chromium, type Browser, type Page } from "playwright";
import type { DiscoveredBusiness } from "@/lib/types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface DiscoverOptions {
  limit?: number;
  onLog?: (msg: string, level?: "info" | "success" | "warn" | "error") => void;
}

interface PlaceRef {
  name: string;
  mapsUrl: string;
}

/**
 * Scrape Google Maps for businesses matching `industry in location`.
 * Best-effort and resilient: handles the consent page, scrolls the results
 * feed, then opens each place to pull website/phone/address. Throws on a hard
 * failure (caller falls back to the directory source).
 */
export async function discoverViaGoogleMaps(
  industry: string,
  location: string,
  opts: DiscoverOptions = {}
): Promise<DiscoveredBusiness[]> {
  const limit = Math.max(1, Math.min(opts.limit ?? 30, 120));
  const log = opts.onLog ?? (() => {});
  const headless = (process.env.HEADLESS ?? "true").toLowerCase() !== "false";

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      userAgent: UA,
      locale: "en-US",
      viewport: { width: 1280, height: 900 },
    });
    const page = await context.newPage();

    const query = `${industry} in ${location}`.trim();
    const url = `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
    log(`Opening Google Maps for "${query}"…`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });

    await dismissConsent(page, log);

    const refs = await collectPlaceRefs(page, limit, log);
    if (!refs.length) throw new Error("no results in Google Maps feed");
    log(`Found ${refs.length} place(s); opening each for contact details…`, "success");

    const businesses: DiscoveredBusiness[] = [];
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      try {
        const details = await extractPlaceDetails(page, ref);
        businesses.push(details);
      } catch {
        // A single place failing should not abort the whole scan.
        businesses.push({
          name: ref.name,
          website: "",
          phone: "",
          email: "",
          address: "",
          source: "google maps",
        });
      }
    }
    return businesses;
  } finally {
    await browser?.close().catch(() => {});
  }
}

async function dismissConsent(
  page: Page,
  log: (m: string, l?: "info" | "success" | "warn" | "error") => void
): Promise<void> {
  if (!/consent\.google\.|\/consent/i.test(page.url())) {
    // Sometimes an in-page dialog appears instead of a redirect.
    const inPage = page.getByRole("button", { name: /accept all|reject all|i agree/i }).first();
    if (await inPage.isVisible().catch(() => false)) {
      await inPage.click().catch(() => {});
      await page.waitForTimeout(800);
    }
    return;
  }
  log("Handling Google consent screen…");
  const btn = page.getByRole("button", { name: /accept all|reject all|i agree/i }).first();
  await btn.click({ timeout: 8000 }).catch(() => {});
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1000);
}

async function collectPlaceRefs(
  page: Page,
  limit: number,
  log: (m: string, l?: "info" | "success" | "warn" | "error") => void
): Promise<PlaceRef[]> {
  const feed = page.locator('div[role="feed"]');
  await feed.waitFor({ timeout: 20_000 }).catch(() => {});

  const seen = new Map<string, string>(); // mapsUrl -> name
  let stable = 0;
  for (let i = 0; i < 25 && seen.size < limit && stable < 4; i++) {
    const cards = page.locator("a.hfpxzc");
    const count = await cards.count();
    for (let c = 0; c < count; c++) {
      const card = cards.nth(c);
      const href = await card.getAttribute("href").catch(() => null);
      const name = (await card.getAttribute("aria-label").catch(() => null))?.trim();
      if (href && name && !seen.has(href)) seen.set(href, name);
    }
    const before = seen.size;
    await feed.evaluate((el) => el.scrollBy(0, el.scrollHeight)).catch(() => {});
    await page.waitForTimeout(1600);
    stable = seen.size === before ? stable + 1 : 0;
    log(`Scanning results… ${seen.size} found`);
  }

  return Array.from(seen.entries())
    .slice(0, limit)
    .map(([mapsUrl, name]) => ({ mapsUrl, name }));
}

async function extractPlaceDetails(page: Page, ref: PlaceRef): Promise<DiscoveredBusiness> {
  await page.goto(ref.mapsUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("h1").first().waitFor({ timeout: 10_000 }).catch(() => {});

  const name = (await page.locator("h1").first().textContent().catch(() => null))?.trim() || ref.name;

  // Website: the "authority" action button links to the external site.
  let website = "";
  const websiteEl = page.locator('a[data-item-id="authority"], a[aria-label^="Website"]').first();
  if (await websiteEl.count()) {
    website = (await websiteEl.getAttribute("href").catch(() => "")) || "";
  }

  // Phone: data-item-id="phone:tel:+1 514…"
  let phone = "";
  const phoneEl = page.locator('button[data-item-id^="phone"]').first();
  if (await phoneEl.count()) {
    const id = (await phoneEl.getAttribute("data-item-id").catch(() => "")) || "";
    phone = id.replace(/^phone:tel:/, "").trim();
    if (!phone) {
      const aria = (await phoneEl.getAttribute("aria-label").catch(() => "")) || "";
      phone = aria.replace(/^phone:?/i, "").trim();
    }
  }

  // Address
  let address = "";
  const addrEl = page.locator('button[data-item-id="address"]').first();
  if (await addrEl.count()) {
    const aria = (await addrEl.getAttribute("aria-label").catch(() => "")) || "";
    address = aria.replace(/^address:?/i, "").trim();
  }

  return { name, website: website.trim(), phone, email: "", address, source: "google maps" };
}
