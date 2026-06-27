import { getSql } from "./index";
import type { OutreachMessage, OutreachType } from "@/lib/types";

interface OutreachRow {
  id: number;
  lead_id: number;
  type: string;
  message: string;
  sent: number;
  created_at: string;
}

function rowToMsg(r: OutreachRow): OutreachMessage {
  return { ...r, type: r.type as OutreachType, sent: !!r.sent };
}

/** Store (or replace) a generated message of a given type for a lead. */
export async function saveOutreach(
  leadId: number,
  type: OutreachType,
  message: string
): Promise<OutreachMessage> {
  const sql = getSql();
  // Keep one message per (lead, type): drop the previous one when regenerating.
  await sql`DELETE FROM outreach WHERE lead_id = ${leadId} AND type = ${type}`;
  const rows = await sql<OutreachRow[]>`
    INSERT INTO outreach (lead_id, type, message)
    VALUES (${leadId}, ${type}, ${message})
    RETURNING *`;
  return rowToMsg(rows[0]);
}

export async function listOutreach(leadId: number): Promise<OutreachMessage[]> {
  const sql = getSql();
  const rows = await sql<OutreachRow[]>`
    SELECT * FROM outreach WHERE lead_id = ${leadId} ORDER BY type`;
  return rows.map(rowToMsg);
}

export async function markSent(id: number, sent: boolean): Promise<void> {
  const sql = getSql();
  await sql`UPDATE outreach SET sent = ${sent ? 1 : 0} WHERE id = ${id}`;
}
