import * as cheerio from "cheerio";
import type { SiteSignals } from "@/lib/types";

const CTA_WORDS = [
  "contact",
  "call",
  "quote",
  "get started",
  "get a quote",
  "book",
  "schedule",
  "sign up",
  "signup",
  "request",
  "free",
  "buy",
  "shop now",
  "order",
  "subscribe",
  "learn more",
  "get in touch",
  "enquire",
  "inquire",
];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
// North-American-ish phone numbers; loose by design.
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

/**
 * Pure HTML → quality-signal extraction. No network; fully unit-testable.
 */
export function parseSignals(html: string, url: string, loadMs: number): SiteSignals {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();

  const title = ($("title").first().text() || "").trim();
  const metaDescription = ($('meta[name="description"]').attr("content") || "").trim();
  const hasViewportMeta = $('meta[name="viewport"]').length > 0;

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) headings.push(t);
  });

  const text = $("body").text().replace(/\s+/g, " ").trim();

  // CTA detection: explicit buttons + links/buttons whose label reads like a CTA.
  let ctaCount = $('button, input[type="submit"], input[type="button"], [role="button"]').length;
  $("a, button").each((_, el) => {
    const label = ($(el).text() || "").toLowerCase();
    const cls = ($(el).attr("class") || "").toLowerCase();
    if (cls.includes("btn") || cls.includes("button")) ctaCount++;
    else if (label && CTA_WORDS.some((w) => label.includes(w))) ctaCount++;
  });

  const formCount = $("form").length;

  // Contact info: tel:/mailto: links or a phone/email pattern in the text.
  const hasTel = $('a[href^="tel:"]').length > 0;
  const hasMailto = $('a[href^="mailto:"]').length > 0;
  const emailInText = text.match(EMAIL_RE)?.[0];
  const mailtoHref = $('a[href^="mailto:"]').first().attr("href")?.replace(/^mailto:/i, "").split("?")[0];
  const contactEmail = (mailtoHref || emailInText || "").trim() || undefined;
  const hasContactInfo = hasTel || hasMailto || !!contactEmail || PHONE_RE.test(text);

  // Contact page: a link that points to / reads as "contact".
  let hasContactPage = false;
  $("a").each((_, el) => {
    const href = ($(el).attr("href") || "").toLowerCase();
    const label = ($(el).text() || "").toLowerCase();
    if (href.includes("contact") || /\bcontact\b/.test(label)) hasContactPage = true;
  });

  return {
    url,
    ok: true,
    statusCode: 200,
    title,
    metaDescription,
    text,
    headings,
    ctaCount,
    formCount,
    hasContactPage,
    hasContactInfo,
    hasViewportMeta,
    contactEmail,
    loadMs,
    bytes: Buffer.byteLength(html),
  };
}
