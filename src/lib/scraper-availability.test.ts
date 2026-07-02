import { describe, it, expect } from "vitest";
import { isDiscoveryBlocked } from "./scraper-availability";

describe("isDiscoveryBlocked", () => {
  it("allows discovery locally (no VERCEL, no flag)", () => {
    expect(isDiscoveryBlocked({})).toBe(false);
  });

  it("blocks discovery on the hosted Vercel site by default", () => {
    expect(isDiscoveryBlocked({ VERCEL: "1" })).toBe(true);
  });

  it("allows discovery on Vercel when explicitly enabled", () => {
    expect(isDiscoveryBlocked({ VERCEL: "1", NEXT_PUBLIC_SCRAPER_ENABLED: "true" })).toBe(false);
  });

  it("stays enabled locally regardless of the flag", () => {
    expect(isDiscoveryBlocked({ NEXT_PUBLIC_SCRAPER_ENABLED: "true" })).toBe(false);
  });
});
