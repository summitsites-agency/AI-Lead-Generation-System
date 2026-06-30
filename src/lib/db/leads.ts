import { getSql } from "./index";
import type { Lead, LeadMeta, LeadStatus, Priority } from "@/lib/types";
import type { WebPresence } from "@/lib/web-presence";

interface LeadRow {
  id: number;
  name: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  industry: string;
  location: string;
  source: string;
  design_score: number;
  seo_score: number;
  conversion_score: number;
  lead_score: number;
  priority: string;
  status: string;
  ai_summary: string;
  issues: string;
  opportunities: string;
  engine: string;
  rating: number | null;
  review_count: number | null;
  value_score: number | null;
  builder: string | null;
  web_presence: string;
  priority_locked: number;
  meta: string | null;
  created_at: string;
}

function rowToLead(r: LeadRow): Lead {
  return {
    ...r,
    priority: r.priority as Priority,
    status: r.status as LeadStatus,
    engine: r.engine === "ai" ? "ai" : "fallback",
    web_presence: (r.web_presence as WebPresence) || "site",
    priority_locked: !!r.priority_locked,
    meta: parseMeta(r.meta),
    value_score: r.value_score ?? 50,
    issues: safeJson(r.issues),
    opportunities: safeJson(r.opportunities),
  };
}

function parseMeta(s: string | null): LeadMeta | null {
  if (!s) return null;
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as LeadMeta) : null;
  } catch {
    return null;
  }
}

function safeJson(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export type NewLead = Omit<
  Lead,
  "id" | "created_at" | "priority_locked" | "meta" | "rating" | "review_count" | "value_score" | "builder"
> & {
  meta?: LeadMeta | null;
  rating?: number | null;
  review_count?: number | null;
  value_score?: number;
  builder?: string | null;
};

/** Insert a lead, or update the existing row for the same website (re-scan). */
export async function upsertLead(lead: NewLead): Promise<Lead> {
  const sql = getSql();
  const row = {
    name: lead.name,
    website: lead.website,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
    industry: lead.industry,
    location: lead.location,
    source: lead.source,
    design_score: lead.design_score,
    seo_score: lead.seo_score,
    conversion_score: lead.conversion_score,
    lead_score: lead.lead_score,
    priority: lead.priority,
    status: lead.status,
    ai_summary: lead.ai_summary,
    issues: JSON.stringify(lead.issues ?? []),
    opportunities: JSON.stringify(lead.opportunities ?? []),
    engine: lead.engine,
    web_presence: lead.web_presence,
    meta: lead.meta ? JSON.stringify(lead.meta) : null,
    rating: lead.rating ?? null,
    review_count: lead.review_count ?? null,
    value_score: lead.value_score ?? 50,
    builder: lead.builder ?? null,
  };
  const rows = await sql<LeadRow[]>`
    INSERT INTO leads ${sql(row)}
    ON CONFLICT (website) DO UPDATE SET
      name = excluded.name, phone = excluded.phone, email = excluded.email,
      address = excluded.address, industry = excluded.industry, location = excluded.location,
      source = excluded.source, design_score = excluded.design_score,
      seo_score = excluded.seo_score, conversion_score = excluded.conversion_score,
      lead_score = excluded.lead_score,
      priority = CASE WHEN leads.priority_locked = 1 THEN leads.priority ELSE excluded.priority END,
      ai_summary = excluded.ai_summary, issues = excluded.issues,
      opportunities = excluded.opportunities, engine = excluded.engine,
      web_presence = excluded.web_presence, meta = excluded.meta,
      rating = excluded.rating, review_count = excluded.review_count,
      value_score = excluded.value_score, builder = excluded.builder
    RETURNING *
  `;
  return rowToLead(rows[0]);
}

export interface LeadFilter {
  priority?: Priority;
  status?: LeadStatus;
  industry?: string;
  search?: string;
  sort?: "rank" | "score" | "recent" | "name";
  /** hide leads marked "not_a_lead" (used by dashboard/campaigns) */
  hideDisqualified?: boolean;
  /** filter by web presence; "no_site" = anything that isn't a real site */
  presence?: WebPresence | "no_site";
}

export async function listLeads(filter: LeadFilter = {}): Promise<Lead[]> {
  const sql = getSql();

  // Build the WHERE clause from composable SQL fragments (each safely parameterized).
  const conds: ReturnType<typeof sql>[] = [];
  if (filter.priority) conds.push(sql`priority = ${filter.priority}`);
  if (filter.status) conds.push(sql`status = ${filter.status}`);
  if (filter.industry) conds.push(sql`industry = ${filter.industry}`);
  if (filter.search) {
    const q = `%${filter.search}%`;
    conds.push(sql`(name ILIKE ${q} OR website ILIKE ${q})`);
  }
  if (filter.hideDisqualified) conds.push(sql`status != 'not_a_lead'`);
  if (filter.presence === "no_site") conds.push(sql`web_presence != 'site'`);
  else if (filter.presence) conds.push(sql`web_presence = ${filter.presence}`);

  const where = conds.length
    ? conds.reduce((acc, c, i) => (i === 0 ? sql`WHERE ${c}` : sql`${acc} AND ${c}`), sql``)
    : sql``;

  const order =
    filter.sort === "name"
      ? sql`name ASC`
      : filter.sort === "recent"
        ? sql`created_at DESC`
        : filter.sort === "score"
          ? sql`lead_score DESC`
          : sql`lead_score * COALESCE(value_score, 50) DESC`;

  const rows = await sql<LeadRow[]>`SELECT * FROM leads ${where} ORDER BY ${order}`;
  return rows.map(rowToLead);
}

export async function getLead(id: number): Promise<Lead | null> {
  const sql = getSql();
  const rows = await sql<LeadRow[]>`SELECT * FROM leads WHERE id = ${id}`;
  return rows[0] ? rowToLead(rows[0]) : null;
}

export async function updateLeadStatus(id: number, status: LeadStatus): Promise<Lead | null> {
  const sql = getSql();
  await sql`UPDATE leads SET status = ${status} WHERE id = ${id}`;
  return getLead(id);
}

/** Manually set a lead's priority and lock it against future re-scoring. */
export async function updateLeadPriority(id: number, priority: Priority): Promise<Lead | null> {
  const sql = getSql();
  await sql`UPDATE leads SET priority = ${priority}, priority_locked = 1 WHERE id = ${id}`;
  return getLead(id);
}

/** Update a lead's industry label (used to clean up the analytics breakdown). */
export async function updateLeadIndustry(id: number, industry: string): Promise<Lead | null> {
  const sql = getSql();
  await sql`UPDATE leads SET industry = ${industry} WHERE id = ${id}`;
  return getLead(id);
}

/** Permanently delete a lead (its outreach messages cascade-delete). */
export async function deleteLead(id: number): Promise<boolean> {
  const sql = getSql();
  const res = await sql`DELETE FROM leads WHERE id = ${id}`;
  return res.count > 0;
}

export interface Stats {
  total: number;
  high: number;
  noSite: number;
  avgScore: number;
  estConversions: number;
  byPriority: { HIGH: number; MEDIUM: number; LOW: number };
  byIndustry: { industry: string; count: number }[];
  scoreBuckets: { bucket: string; count: number }[];
}

export async function getStats(): Promise<Stats> {
  const sql = getSql();
  // All KPIs ignore leads marked "not_a_lead" so disqualifying one cleans the
  // pipeline. COUNT/AVG are cast to int/float so postgres.js returns numbers
  // (it returns bigint/numeric as strings by default).
  const [{ total }] = await sql<{ total: number }[]>`
    SELECT COUNT(*)::int total FROM leads WHERE status != 'not_a_lead'`;
  const [{ high }] = await sql<{ high: number }[]>`
    SELECT COUNT(*)::int high FROM leads WHERE priority = 'HIGH' AND status != 'not_a_lead'`;
  const [{ no_site }] = await sql<{ no_site: number }[]>`
    SELECT COUNT(*)::int no_site FROM leads WHERE web_presence != 'site' AND status != 'not_a_lead'`;
  const [{ avg }] = await sql<{ avg: number | null }[]>`
    SELECT AVG(lead_score)::float avg FROM leads WHERE status != 'not_a_lead'`;
  const avgScore = Math.round(avg ?? 0);

  const byPriorityRows = await sql<{ priority: Priority; c: number }[]>`
    SELECT priority, COUNT(*)::int c FROM leads WHERE status != 'not_a_lead' GROUP BY priority`;
  const byPriority = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const r of byPriorityRows) byPriority[r.priority] = r.c;

  const byIndustryRows = await sql<{ industry: string; count: number }[]>`
    SELECT COALESCE(NULLIF(industry, ''), 'unknown') industry, COUNT(*)::int count
    FROM leads WHERE status != 'not_a_lead'
    GROUP BY industry ORDER BY count DESC LIMIT 8`;
  const byIndustry = byIndustryRows.map((r) => ({ industry: r.industry, count: r.count }));

  const scoreBuckets = [
    { bucket: "0–40", count: await countRange(sql, 0, 40) },
    { bucket: "41–70", count: await countRange(sql, 41, 70) },
    { bucket: "71–100", count: await countRange(sql, 71, 100) },
  ];

  // Rough "estimated conversions": high-priority leads convert ~12%, medium ~5%.
  const estConversions = Math.round(byPriority.HIGH * 0.12 + byPriority.MEDIUM * 0.05);

  return { total, high, noSite: no_site, avgScore, estConversions, byPriority, byIndustry, scoreBuckets };
}

async function countRange(sql: ReturnType<typeof getSql>, lo: number, hi: number): Promise<number> {
  const [{ c }] = await sql<{ c: number }[]>`
    SELECT COUNT(*)::int c FROM leads
    WHERE lead_score BETWEEN ${lo} AND ${hi} AND status != 'not_a_lead'`;
  return c;
}
