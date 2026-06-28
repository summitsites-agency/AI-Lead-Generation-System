import { describe, it, expect } from "vitest";
import { computeMissing, leadKeyFor } from "./draft";

describe("computeMissing", () => {
  it("lists the blank contact fields", () => {
    expect(
      computeMissing({ name: "Acme", website: "", phone: "", email: "x@y.z", address: "1 St", source: "" })
    ).toEqual(["phone"]);
  });

  it("returns every field when the candidate is empty", () => {
    expect(
      computeMissing({ name: "Acme", website: "", phone: "  ", email: "", address: "", source: "" })
    ).toEqual(["phone", "email", "address"]);
  });
});

describe("leadKeyFor", () => {
  it("synthesizes a name+city key for a no-website lead", () => {
    expect(leadKeyFor("", "Acme Plumbing", "Denver")).toBe("nowebsite://acme-plumbing-denver");
  });

  it("uses the real URL for a business that has a site", () => {
    expect(leadKeyFor("https://acme.example/", "Acme", "Denver")).toBe("https://acme.example");
  });

  it("keeps a social URL as the key rather than synthesizing", () => {
    expect(leadKeyFor("https://instagram.com/acme", "Acme", "Denver")).toBe(
      "https://instagram.com/acme"
    );
  });
});
