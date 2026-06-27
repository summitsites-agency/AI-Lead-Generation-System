import { describe, it, expect } from "vitest";
import { classifyWebPresence, isNoSite, webPresenceLabel } from "./web-presence";

describe("classifyWebPresence", () => {
  it("returns 'none' for blank or unparseable input", () => {
    expect(classifyWebPresence("")).toBe("none");
    expect(classifyWebPresence("   ")).toBe("none");
    expect(classifyWebPresence(undefined)).toBe("none");
    expect(classifyWebPresence("not a url")).toBe("none");
  });

  it("detects social pages (incl. subdomains)", () => {
    expect(classifyWebPresence("https://www.instagram.com/joes")).toBe("social");
    expect(classifyWebPresence("https://facebook.com/joes")).toBe("social");
    expect(classifyWebPresence("https://m.facebook.com/joes")).toBe("social");
    expect(classifyWebPresence("https://tiktok.com/@joes")).toBe("social");
    expect(classifyWebPresence("https://x.com/joes")).toBe("social");
  });

  it("detects directory / listing sites", () => {
    expect(classifyWebPresence("https://www.yelp.com/biz/joes")).toBe("directory");
    expect(classifyWebPresence("https://yellowpages.com/joes")).toBe("directory");
    expect(classifyWebPresence("https://www.houzz.com/pro/joes")).toBe("directory");
  });

  it("treats business.site and real domains as a real site", () => {
    expect(classifyWebPresence("https://joes-plumbing.business.site")).toBe("site");
    expect(classifyWebPresence("https://joesplumbing.com")).toBe("site");
    // bare host (OpenStreetMap sometimes omits the scheme)
    expect(classifyWebPresence("joesplumbing.com")).toBe("site");
  });

  it("does not match look-alike hosts", () => {
    expect(classifyWebPresence("https://notyelp.com")).toBe("site");
  });
});

describe("isNoSite", () => {
  it("is true for everything but a real site", () => {
    expect(isNoSite("none")).toBe(true);
    expect(isNoSite("social")).toBe(true);
    expect(isNoSite("directory")).toBe(true);
    expect(isNoSite("site")).toBe(false);
  });
});

describe("webPresenceLabel", () => {
  it("labels by platform when known", () => {
    expect(webPresenceLabel("social", "https://instagram.com/x")).toBe("Instagram");
    expect(webPresenceLabel("directory", "https://yelp.com/biz/x")).toBe("Yelp");
  });

  it("labels no-website leads", () => {
    expect(webPresenceLabel("none", "nowebsite://x")).toBe("No website");
  });
});
