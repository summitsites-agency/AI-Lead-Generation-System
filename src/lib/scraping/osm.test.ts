import { describe, it, expect } from "vitest";
import { mapOsmResult, type NominatimResult } from "./osm";

describe("mapOsmResult", () => {
  it("pulls name, website, phone, email and address from OSM tags", () => {
    const r: NominatimResult = {
      display_name: "Acme Plumbing, 12 Main St, Denver, CO, USA",
      namedetails: { name: "Acme Plumbing" },
      extratags: {
        website: "https://acme.example",
        phone: "+1 303 555 0100",
        email: "hi@acme.example",
      },
    };
    expect(mapOsmResult(r)).toEqual({
      name: "Acme Plumbing",
      website: "https://acme.example",
      phone: "+1 303 555 0100",
      email: "hi@acme.example",
      address: "Acme Plumbing, 12 Main St, Denver, CO, USA",
      source: "openstreetmap",
    });
  });

  it("falls back across tag aliases and leaves missing fields blank", () => {
    const r: NominatimResult = {
      display_name: "Bob's Welding, Springfield",
      extratags: { "contact:website": "bobwelds.example", "contact:phone": "555-1" },
    };
    const b = mapOsmResult(r);
    expect(b.name).toBe("Bob's Welding");
    expect(b.website).toBe("bobwelds.example");
    expect(b.phone).toBe("555-1");
    expect(b.email).toBe("");
  });
});
