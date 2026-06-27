import { getSql } from "./index";
import type { ScanJob, ScanStatus } from "@/lib/types";

export async function createScanJob(industry: string, location: string): Promise<number> {
  const sql = getSql();
  const [{ id }] = await sql<{ id: number }[]>`
    INSERT INTO scan_jobs (industry, location, status)
    VALUES (${industry}, ${location}, 'running')
    RETURNING id`;
  return id;
}

export async function updateScanJob(
  id: number,
  patch: Partial<Pick<ScanJob, "status" | "found" | "scraped" | "failed">>
): Promise<void> {
  const fields = Object.keys(patch);
  if (!fields.length) return;
  const sql = getSql();
  await sql`UPDATE scan_jobs SET ${sql(patch)} WHERE id = ${id}`;
}

export async function finishScanJob(id: number, status: ScanStatus): Promise<void> {
  const sql = getSql();
  await sql`UPDATE scan_jobs SET status = ${status} WHERE id = ${id}`;
}

export async function recentScans(limit = 10): Promise<ScanJob[]> {
  const sql = getSql();
  const rows = await sql<ScanJob[]>`
    SELECT * FROM scan_jobs ORDER BY created_at DESC LIMIT ${limit}`;
  return rows.map((r) => ({ ...r }));
}
