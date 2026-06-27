import { describe, it, expect } from "vitest";
import {
  normalizeHandle,
  parseCount,
  parseProfileStats,
  extractProfileFromHtml,
  extractContactFromBio,
  cleanName,
} from "./instagram";

describe("normalizeHandle", () => {
  it("accepts bare handles and strips @", () => {
    expect(normalizeHandle("joescoffee")).toBe("joescoffee");
    expect(normalizeHandle("@joescoffee")).toBe("joescoffee");
    expect(normalizeHandle("  @joes.coffee_  ")).toBe("joes.coffee_");
  });

  it("extracts the handle from a full URL", () => {
    expect(normalizeHandle("https://www.instagram.com/joescoffee/")).toBe("joescoffee");
    expect(normalizeHandle("instagram.com/joescoffee?hl=en")).toBe("joescoffee");
  });

  it("rejects junk and non-Instagram URLs", () => {
    expect(normalizeHandle("")).toBeNull();
    expect(normalizeHandle("not a handle!")).toBeNull();
    expect(normalizeHandle("https://example.com/foo")).toBeNull();
  });
});

describe("parseCount", () => {
  it("parses plain, comma, and abbreviated numbers", () => {
    expect(parseCount("89")).toBe(89);
    expect(parseCount("1,234")).toBe(1234);
    expect(parseCount("12.3k")).toBe(12300);
    expect(parseCount("1.2m")).toBe(1_200_000);
  });

  it("returns null for non-numbers", () => {
    expect(parseCount("")).toBeNull();
    expect(parseCount("abc")).toBeNull();
    expect(parseCount(null)).toBeNull();
  });
});

describe("parseProfileStats", () => {
  it("reads followers / following / posts from og:description", () => {
    const desc =
      "1,234 Followers, 567 Following, 89 Posts - See Instagram photos and videos from Joe's Coffee (@joescoffee)";
    expect(parseProfileStats(desc)).toEqual({ followers: 1234, following: 567, posts: 89 });
  });

  it("handles abbreviated counts", () => {
    expect(parseProfileStats("12.3k Followers, 200 Following, 1,003 Posts")).toEqual({
      followers: 12300,
      following: 200,
      posts: 1003,
    });
  });

  it("returns nulls when absent", () => {
    expect(parseProfileStats("nothing useful here")).toEqual({
      followers: null,
      following: null,
      posts: null,
    });
  });
});

describe("extractProfileFromHtml", () => {
  const html = `<html><head>
    <meta property="og:title" content="Joe&#039;s Coffee (@joescoffee) &bull; Instagram photos and videos" />
    <meta property="og:description" content="1,234 Followers, 567 Following, 89 Posts - Joe&#039;s Coffee (@joescoffee) on Instagram: &quot;Best espresso in town. DM to order.&quot;" />
  </head><body></body></html>`;

  it("pulls name, stats, and bio", () => {
    const p = extractProfileFromHtml(html, "joescoffee");
    expect(p.ok).toBe(true);
    expect(p.name).toBe("Joe's Coffee");
    expect(p.followers).toBe(1234);
    expect(p.posts).toBe(89);
    expect(p.bio).toContain("Best espresso");
  });

  it("reports not-ok when the page has no preview data", () => {
    const p = extractProfileFromHtml("<html><head></head><body>Login</body></html>", "joescoffee");
    expect(p.ok).toBe(false);
  });

  it("cleans an emoji-wrapped, entity-encoded business name", () => {
    const h = `<html><head>
      <meta property="og:title" content="&#x2728;Cake O&#x2019;Clock Montreal&#x2728; (@cakeoclock) &bull; Instagram" />
      <meta property="og:description" content="8,420 Followers, 12 Following, 533 Posts - Cake O&#x2019;Clock (@cakeoclock)" />
    </head></html>`;
    const p = extractProfileFromHtml(h, "cakeoclock");
    expect(p.name).toBe("Cake O'Clock Montreal");
    expect(p.followers).toBe(8420);
  });
});

describe("extractContactFromBio", () => {
  it("finds an email in the bio", () => {
    expect(extractContactFromBio("Order ☕ hello@joescoffee.com").email).toBe(
      "hello@joescoffee.com"
    );
  });

  it("finds a phone number in the bio", () => {
    expect(extractContactFromBio("📞 Bookings 514-555-0192").phone).toBe("514-555-0192");
  });

  it("returns nulls when there's no contact info", () => {
    expect(extractContactFromBio("Best espresso in town")).toEqual({ email: null, phone: null });
  });
});

describe("cleanName", () => {
  it("decodes entities and strips decorative emoji", () => {
    expect(cleanName("&#x2728;Cake O&#x2019;Clock Montreal&#x2728;")).toBe("Cake O'Clock Montreal");
    expect(cleanName("✨Cake O'Clock Montreal✨")).toBe("Cake O'Clock Montreal");
  });

  it("leaves a normal business name untouched", () => {
    expect(cleanName("Blue Bottle Coffee")).toBe("Blue Bottle Coffee");
  });

  it("decodes &amp; without mangling it", () => {
    expect(cleanName("Tom &amp; Jerry&#x2019;s")).toBe("Tom & Jerry's");
  });
});
