import { getSql } from "./index";

/** Persist a single runtime setting (e.g. the active AI provider/model). */
export async function setSetting(key: string, value: string): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
}

export async function getSetting(key: string): Promise<string | null> {
  const sql = getSql();
  const rows = await sql<{ value: string }[]>`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}
