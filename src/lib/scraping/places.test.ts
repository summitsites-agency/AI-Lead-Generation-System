import { describe, it, expect, vi, afterEach } from "vitest";
import { placesAvailable, discoverViaPlaces } from "./places";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("placesAvailable", () => {
  it("is false without a key and true with one", () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(placesAvailable()).toBe(false);
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
    expect(placesAvailable()).toBe(true);
  });
});

describe("discoverViaPlaces", () => {
  it("maps Places results to DiscoveredBusiness with demand signals", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "k");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          places: [
            {
              displayName: { text: "Acme Roofing" },
              websiteUri: "https://acme.test",
              nationalPhoneNumber: "(514) 555-1234",
              formattedAddress: "1 Main St, Montreal",
              rating: 4.6,
              userRatingCount: 182,
            },
            { displayName: { text: "No Site Co" } },
          ],
        }),
      }))
    );

    const list = await discoverViaPlaces("roofing", "Montreal", { limit: 10 });
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({
      name: "Acme Roofing",
      website: "https://acme.test",
      phone: "(514) 555-1234",
      address: "1 Main St, Montreal",
      rating: 4.6,
      reviewCount: 182,
      source: "google places",
    });
    expect(list[1]).toMatchObject({ name: "No Site Co", website: "", rating: null, reviewCount: null });
  });
});
