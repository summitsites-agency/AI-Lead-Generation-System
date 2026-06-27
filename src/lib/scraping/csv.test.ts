import { describe, it, expect } from "vitest";
import { parseImport } from "./csv";

describe("parseImport", () => {
  it("parses one URL per line, normalizing bare hosts", () => {
    const out = parseImport("acme.com\nhttps://foo.io/contact\n   \nnot a url");
    expect(out.map((b) => b.website)).toEqual([
      "https://acme.com/",
      "https://foo.io/contact",
    ]);
    expect(out[0].source).toBe("import");
  });

  it("parses CSV with a header row, order-insensitive", () => {
    const csv = [
      "Name,Phone,Website,Email",
      'Acme Roofing,514-555-1234,acmeroofing.ca,"hi@acme.ca"',
      "Bob's Plumbing,,bobplumbing.com,",
    ].join("\n");
    const out = parseImport(csv);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({
      name: "Acme Roofing",
      phone: "514-555-1234",
      email: "hi@acme.ca",
      website: "https://acmeroofing.ca/",
    });
  });

  it("dedupes repeated websites", () => {
    const out = parseImport("acme.com\nhttps://acme.com");
    expect(out).toHaveLength(1);
  });
});
