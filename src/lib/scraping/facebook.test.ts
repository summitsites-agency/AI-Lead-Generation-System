import { describe, it, expect } from "vitest";
import {
  buildSearchQuery,
  decodeResultUrl,
  parseSearchResults,
  isBusinessPageUrl,
  extractWebsiteFromHtml,
  extractPageFromHtml,
  facebookAnalysis,
} from "./facebook";

describe("buildSearchQuery", () => {
  it("targets facebook.com with industry + location", () => {
    expect(buildSearchQuery("roofing", "Montreal, QC")).toBe(
      "roofing Montreal, QC site:facebook.com"
    );
  });

  it("trims and tolerates a blank location", () => {
    expect(buildSearchQuery("  dentists ", "")).toBe("dentists site:facebook.com");
  });
});

describe("decodeResultUrl", () => {
  it("unwraps a DuckDuckGo /l/?uddg= redirect", () => {
    expect(
      decodeResultUrl("//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.facebook.com%2Fbistrolili&rut=x")
    ).toBe("https://www.facebook.com/bistrolili");
  });

  it("unwraps a Google /url?q= redirect", () => {
    expect(
      decodeResultUrl("/url?q=https://www.facebook.com/joesroofing&sa=U&ved=x")
    ).toBe("https://www.facebook.com/joesroofing");
  });

  it("returns a direct href unchanged", () => {
    expect(decodeResultUrl("https://www.facebook.com/joesroofing")).toBe(
      "https://www.facebook.com/joesroofing"
    );
  });

  it("returns null for junk", () => {
    expect(decodeResultUrl("#")).toBeNull();
    expect(decodeResultUrl("")).toBeNull();
  });
});

describe("parseSearchResults", () => {
  const html = `<div class="results">
    <a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.facebook.com%2Fjoesroofing&rut=a">Joe's Roofing</a>
    <a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.facebook.com%2Fgroups%2F123&rut=b">A group</a>
    <a href="https://www.facebook.com/acmeplumbing/">Acme Plumbing</a>
    <a href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fother&rut=c">Not facebook</a>
    <a href="/search?q=more">Internal</a>
  </div>`;

  it("returns decoded facebook page URLs only, deduped", () => {
    const urls = parseSearchResults(html);
    expect(urls).toContain("https://www.facebook.com/joesroofing");
    expect(urls).toContain("https://www.facebook.com/acmeplumbing/");
    // groups + non-facebook + internal are filtered out
    expect(urls.some((u) => u.includes("/groups/"))).toBe(false);
    expect(urls.some((u) => u.includes("example.com"))).toBe(false);
    expect(urls).toHaveLength(2);
  });
});

describe("isBusinessPageUrl", () => {
  it("keeps real page URLs", () => {
    expect(isBusinessPageUrl("https://www.facebook.com/joesroofing")).toBe(true);
    expect(isBusinessPageUrl("https://facebook.com/Acme.Plumbing.Inc/")).toBe(true);
  });

  it("rejects non-page paths", () => {
    for (const u of [
      "https://www.facebook.com/groups/123",
      "https://www.facebook.com/events/123",
      "https://www.facebook.com/watch/",
      "https://www.facebook.com/profile.php?id=123",
      "https://www.facebook.com/story.php?id=1",
      "https://www.facebook.com/login/",
      "https://www.facebook.com/sharer/sharer.php",
      "https://www.facebook.com/",
      "https://example.com/joes",
    ]) {
      expect(isBusinessPageUrl(u)).toBe(false);
    }
  });
});

describe("extractWebsiteFromHtml", () => {
  it("decodes an l.facebook.com/l.php?u= outbound link", () => {
    const html = `<a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fjoesroofing.com%2F&h=abc">joesroofing.com</a>`;
    expect(extractWebsiteFromHtml(html)).toBe("https://joesroofing.com/");
  });

  it("ignores internal facebook links and returns null", () => {
    const html = `<a href="https://www.facebook.com/joesroofing/about">About</a>`;
    expect(extractWebsiteFromHtml(html)).toBeNull();
  });
});

describe("extractPageFromHtml", () => {
  const html = `<html><head>
    <meta property="og:title" content="Joe&#39;s Roofing" />
    <meta property="og:description" content="Roofing Company in Montreal, QC. Call 514-555-0192 or email hi@joesroofing.com" />
  </head><body>
    <a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fjoesroofing.com%2F&h=abc">Website</a>
  </body></html>`;

  it("pulls name, website, and best-effort contact", () => {
    const biz = extractPageFromHtml(html, "https://www.facebook.com/joesroofing");
    expect(biz.name).toBe("Joe's Roofing");
    expect(biz.source).toBe("facebook");
    expect(biz.website).toBe("https://www.facebook.com/joesroofing");
    expect(biz.facebook?.website).toBe("https://joesroofing.com/");
    expect(biz.email).toBe("hi@joesroofing.com");
    expect(biz.phone).toBe("514-555-0192");
  });

  it("reports website null when no external link is present", () => {
    const biz = extractPageFromHtml(
      `<html><head><meta property="og:title" content="Bob's Plumbing" /></head><body></body></html>`,
      "https://www.facebook.com/bobsplumbing"
    );
    expect(biz.name).toBe("Bob's Plumbing");
    expect(biz.facebook?.website).toBeNull();
  });
});

describe("facebookAnalysis", () => {
  it("scores a no-website page as a top opportunity", () => {
    const a = facebookAnalysis(null);
    expect(a.lead_score).toBe(85);
    expect(a.summary).toMatch(/no real website/i);
  });

  it("scores a page that already has a website lower", () => {
    const a = facebookAnalysis("https://joesroofing.com/");
    expect(a.lead_score).toBe(55);
    expect(a.summary).toMatch(/already has a website/i);
  });
});
