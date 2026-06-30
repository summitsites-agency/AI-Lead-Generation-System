import { describe, it, expect } from "vitest";
import { parseSignals, detectBuilder } from "./parse";

const GOOD = `<!doctype html><html><head>
  <title>Acme Roofing — Montreal's Trusted Roofers</title>
  <meta name="description" content="Quality roofing in Montreal. Free quotes.">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head><body>
  <h1>Roofing done right</h1><h2>Our services</h2><h3>Service area</h3>
  <p>We have served Montreal for 20 years with reliable roof repair and replacement.</p>
  <a class="btn" href="/contact">Get a quote</a>
  <a href="tel:+15145551234">Call us</a>
  <a href="mailto:hello@acmeroofing.ca">Email</a>
  <form><input name="email"><button type="submit">Send</button></form>
</body></html>`;

const POOR = `<!doctype html><html><head><title>Home</title></head><body>
  <p>Welcome.</p>
</body></html>`;

describe("parseSignals", () => {
  it("extracts rich signals from a well-built site", () => {
    const s = parseSignals(GOOD, "https://acmeroofing.ca", 700);
    expect(s.ok).toBe(true);
    expect(s.title).toContain("Acme Roofing");
    expect(s.metaDescription).toBeTruthy();
    expect(s.hasViewportMeta).toBe(true);
    expect(s.headings).toEqual(["Roofing done right", "Our services", "Service area"]);
    expect(s.ctaCount).toBeGreaterThan(0);
    expect(s.formCount).toBe(1);
    expect(s.hasContactInfo).toBe(true);
    expect(s.hasContactPage).toBe(true);
    expect(s.contactEmail).toBe("hello@acmeroofing.ca");
  });

  it("flags the gaps in a thin site", () => {
    const s = parseSignals(POOR, "https://poor.example", 500);
    expect(s.metaDescription).toBe("");
    expect(s.hasViewportMeta).toBe(false);
    expect(s.formCount).toBe(0);
    expect(s.hasContactInfo).toBe(false);
    expect(s.hasContactPage).toBe(false);
    expect(s.headings).toEqual([]);
  });
});

describe("detectBuilder", () => {
  it("detects common builders from markup", () => {
    expect(detectBuilder(`<link href="/wp-content/themes/x/style.css">`)).toBe("WordPress");
    expect(detectBuilder(`<script src="https://static.parastorage.com/x.js"></script>`)).toBe("Wix");
    expect(detectBuilder(`<div class="sqs-block">`.concat("squarespace-cdn.com"))).toBe("Squarespace");
    expect(detectBuilder(`<script src="https://cdn.shopify.com/s/x.js">`)).toBe("Shopify");
    expect(detectBuilder(`<img src="https://img1.wsimg.com/x.png">`)).toBe("GoDaddy");
  });

  it("returns null when no builder markers are present", () => {
    expect(detectBuilder(`<html><body><h1>Hand coded</h1></body></html>`)).toBeNull();
  });

  it("is surfaced on parsed signals", () => {
    const html = `<!doctype html><html><head><title>x</title></head><body><link href="/wp-includes/x.css"></body></html>`;
    expect(parseSignals(html, "https://x.test", 100).builder).toBe("WordPress");
  });
});
