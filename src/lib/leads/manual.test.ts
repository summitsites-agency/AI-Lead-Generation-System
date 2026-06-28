import { describe, it, expect } from "vitest";
import { buildManualLead } from "./manual";

const base = {
  name: "Acme Plumbing",
  city: "Denver",
  website: "",
  phone: "303-555-0100",
  email: "",
  address: "12 Main St, Denver",
  industry: "Plumbing",
};

describe("buildManualLead", () => {
  it("creates a high-value no-website lead with a name+city key", () => {
    const lead = buildManualLead(base);
    expect(lead.website).toBe("nowebsite://acme-plumbing-denver");
    expect(lead.web_presence).toBe("none");
    expect(lead.source).toBe("manual-lookup");
    expect(lead.location).toBe("Denver");
    expect(lead.phone).toBe("303-555-0100");
    expect(lead.lead_score).toBeGreaterThanOrEqual(80);
    expect(lead.priority).toBe("HIGH");
    expect(lead.engine).toBe("fallback");
  });

  it("keeps a real website as the key and marks presence as a site", () => {
    const lead = buildManualLead({ ...base, website: "https://acme.example/" });
    expect(lead.website).toBe("https://acme.example");
    expect(lead.web_presence).toBe("site");
  });

  it("treats a social URL as a no-real-site opportunity", () => {
    const lead = buildManualLead({ ...base, website: "https://instagram.com/acme" });
    expect(lead.web_presence).toBe("social");
    expect(lead.website).toBe("https://instagram.com/acme");
    expect(lead.lead_score).toBeGreaterThanOrEqual(80);
  });
});
