/** Minimal className combiner — joins truthy class fragments. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Format a number with thousands separators, em-dash for nullish. */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US");
}

/** Lowercase, hyphenated slug for building stable keys from names. */
export function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

/** Normalize a possibly-bare host into an absolute http(s) URL. */
export function normalizeUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const u = new URL(withScheme);
    if (!u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/**
 * Canonical form of a URL, used as a dedup key so the same business never
 * produces multiple lead rows across re-scans. Collapses the differences that
 * don't change identity: scheme (forces https), a leading `www.`, host case,
 * a trailing slash, and any query string or fragment.
 *
 * `https://WWW.Acme.com/`, `http://acme.com`, and `acme.com?ref=maps` all map
 * to `https://acme.com`. Non-http(s) keys (e.g. `nowebsite://…`) and bare hosts
 * that can't be parsed are lowercased and returned as-is.
 */
export function canonicalUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const normalized = normalizeUrl(v);
  if (!normalized) return v.toLowerCase();
  try {
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, ""); // drop trailing slash(es)
    return `https://${host}${path}`;
  } catch {
    return v.toLowerCase();
  }
}

/** Short, display-friendly host from a URL. */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
