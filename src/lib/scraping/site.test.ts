import { describe, it, expect, vi, afterEach } from "vitest";
import { scrapeSite } from "./site";

function htmlResponse(html: string) {
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => (k.toLowerCase() === "content-type" ? "text/html" : null) },
    text: async () => html,
  };
}

const HOME_NO_EMAIL = `<!doctype html><html><head><title>Acme</title></head>
  <body><h1>Acme</h1><a href="/contact">Contact</a></body></html>`;
const CONTACT_WITH_EMAIL = `<!doctype html><html><head><title>Contact</title></head>
  <body><a href="mailto:hello@acme.test">Email us</a></body></html>`;
const HOME_WITH_EMAIL = `<!doctype html><html><head><title>Acme</title></head>
  <body><a href="mailto:owner@acme.test">Email</a></body></html>`;

afterEach(() => vi.unstubAllGlobals());

describe("scrapeSite contact crawl", () => {
  it("fetches /contact and merges the email when the homepage has none", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith("/contact") ? htmlResponse(CONTACT_WITH_EMAIL) : htmlResponse(HOME_NO_EMAIL)
    );
    vi.stubGlobal("fetch", fetchMock);

    const s = await scrapeSite("https://acme.test");
    expect(s.contactEmail).toBe("hello@acme.test");
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toContain("https://acme.test/contact");
  });

  it("does not crawl extra pages when the homepage already has an email", async () => {
    const fetchMock = vi.fn(async () => htmlResponse(HOME_WITH_EMAIL));
    vi.stubGlobal("fetch", fetchMock);

    const s = await scrapeSite("https://acme.test");
    expect(s.contactEmail).toBe("owner@acme.test");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
