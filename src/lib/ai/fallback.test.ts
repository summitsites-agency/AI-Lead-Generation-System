import { describe, it, expect } from "vitest";
import { analyzeWithRules } from "./fallback";
import type { SiteSignals } from "@/lib/types";

function signals(overrides: Partial<SiteSignals> = {}): SiteSignals {
  // A strong, well-built baseline site.
  return {
    url: "https://example.com",
    ok: true,
    statusCode: 200,
    title: "Acme Roofing — Trusted Roofers in Montreal",
    metaDescription: "Professional roofing services across Montreal. Free quotes.",
    text: "x".repeat(2000),
    headings: ["Welcome", "Our Services", "Contact Us"],
    ctaCount: 3,
    formCount: 1,
    hasContactPage: true,
    hasContactInfo: true,
    hasViewportMeta: true,
    loadMs: 800,
    bytes: 50000,
    ...overrides,
  };
}

describe("analyzeWithRules", () => {
  it("scores a strong website as LOW opportunity", () => {
    const a = analyzeWithRules(signals());
    expect(a.lead_score).toBeLessThanOrEqual(40);
    expect(a.engine).toBe("fallback");
    expect(a.design_score).toBeGreaterThanOrEqual(8);
  });

  it("applies the exact spec risk weights for a poor website", () => {
    // Missing CTA (+20), no contact (+20), weak SEO (+15), poor mobile (+20), outdated (+25) = 100
    const a = analyzeWithRules(
      signals({
        title: "",
        metaDescription: "",
        headings: [],
        text: "tiny",
        ctaCount: 0,
        formCount: 0,
        hasContactPage: false,
        hasContactInfo: false,
        hasViewportMeta: false,
        bytes: 1000,
        loadMs: 6000,
      })
    );
    expect(a.lead_score).toBe(100);
    expect(a.issues.length).toBeGreaterThanOrEqual(5);
    expect(a.design_score).toBe(1);
  });

  it("treats an unreachable site as a high-opportunity lead", () => {
    const a = analyzeWithRules(signals({ ok: false, error: "timeout" }));
    expect(a.lead_score).toBeGreaterThanOrEqual(71);
    expect(a.issues[0]).toMatch(/load/i);
  });

  it("adds exactly +20 for a missing CTA in isolation", () => {
    const base = analyzeWithRules(signals());
    const noCta = analyzeWithRules(signals({ ctaCount: 0, formCount: 1 }));
    expect(noCta.lead_score - base.lead_score).toBe(20);
  });
});
