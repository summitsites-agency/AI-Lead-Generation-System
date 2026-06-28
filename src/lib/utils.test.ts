import { describe, it, expect } from "vitest";
import { canonicalUrl } from "./utils";

describe("canonicalUrl", () => {
  it("collapses URL-form variants of the same site onto one key", () => {
    const expected = "https://acme.com";
    expect(canonicalUrl("acme.com")).toBe(expected);
    expect(canonicalUrl("http://acme.com")).toBe(expected);
    expect(canonicalUrl("https://acme.com")).toBe(expected);
    expect(canonicalUrl("https://www.acme.com")).toBe(expected);
    expect(canonicalUrl("https://WWW.Acme.com/")).toBe(expected);
    expect(canonicalUrl("  https://acme.com/  ")).toBe(expected);
  });

  it("drops query strings and fragments but keeps a meaningful path", () => {
    expect(canonicalUrl("https://acme.com/?ref=googlemaps")).toBe("https://acme.com");
    expect(canonicalUrl("https://acme.com/about/#team")).toBe("https://acme.com/about");
  });

  it("returns '' for blank input", () => {
    expect(canonicalUrl("")).toBe("");
    expect(canonicalUrl("   ")).toBe("");
  });

  it("lowercases non-http(s) keys (e.g. nowebsite placeholders) as-is", () => {
    expect(canonicalUrl("nowebsite://Joes-Plumbing")).toBe("nowebsite://joes-plumbing");
  });
});
