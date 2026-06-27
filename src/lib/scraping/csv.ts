import type { DiscoveredBusiness } from "@/lib/types";
import { normalizeUrl, displayHost } from "@/lib/utils";

/**
 * Parse a manual import blob. Accepts either:
 *  - one URL per line (bare hosts ok), or
 *  - CSV with a header row (name,website,phone,email,address — order-insensitive).
 * Returns businesses with a usable website.
 */
export function parseImport(input: string): DiscoveredBusiness[] {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const looksCsv =
    lines[0].includes(",") && /name|website|url|email|phone|address/i.test(lines[0]);

  return looksCsv ? parseCsv(lines) : parseUrls(lines);
}

function parseUrls(lines: string[]): DiscoveredBusiness[] {
  const out: DiscoveredBusiness[] = [];
  for (const line of lines) {
    const url = normalizeUrl(line);
    if (!url) continue;
    out.push({
      name: displayHost(url),
      website: url,
      phone: "",
      email: "",
      address: "",
      source: "import",
    });
  }
  return dedupe(out);
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      cells.push(cur);
      cur = "";
    } else cur += ch;
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

function parseCsv(lines: string[]): DiscoveredBusiness[] {
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (...names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const iName = idx("name", "business", "company");
  const iSite = idx("website", "url", "site", "web");
  const iPhone = idx("phone", "tel");
  const iEmail = idx("email", "mail");
  const iAddr = idx("address", "location");

  const out: DiscoveredBusiness[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]);
    const url = normalizeUrl(iSite >= 0 ? cells[iSite] ?? "" : "");
    if (!url) continue;
    out.push({
      name: (iName >= 0 ? cells[iName] : "")?.trim() || displayHost(url),
      website: url,
      phone: (iPhone >= 0 ? cells[iPhone] : "")?.trim() || "",
      email: (iEmail >= 0 ? cells[iEmail] : "")?.trim() || "",
      address: (iAddr >= 0 ? cells[iAddr] : "")?.trim() || "",
      source: "import",
    });
  }
  return dedupe(out);
}

function dedupe(list: DiscoveredBusiness[]): DiscoveredBusiness[] {
  const seen = new Set<string>();
  return list.filter((b) => {
    const key = b.website.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
