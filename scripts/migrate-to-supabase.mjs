// One-time migration: apply the Postgres schema to Supabase and copy every row
// from the local SQLite database (data/leadgen.db) into it.
//
// Usage (Node 20.6+):
//   npm run migrate:supabase
// which runs:  node --env-file=.env scripts/migrate-to-supabase.mjs
//
// Safe to re-run: it TRUNCATEs the destination tables first, then re-copies.

import Database from "better-sqlite3";
import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "DATABASE_URL is not set. Put your Supabase pooled (Transaction) connection " +
      "string in .env, then run `npm run migrate:supabase`."
  );
  process.exit(1);
}

const sql = postgres(url, { prepare: false, ssl: "require" });

try {
  // 1. Apply the schema.
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  console.log("→ Applying schema to Supabase…");
  await sql.unsafe(schema);
  console.log("  schema applied.");

  // 2. Find the local SQLite database.
  const dbPath = path.join(process.cwd(), "data", "leadgen.db");
  if (!existsSync(dbPath)) {
    console.log(`No local database at ${dbPath} — schema is ready, nothing to copy.`);
    await sql.end();
    process.exit(0);
  }

  const lite = new Database(dbPath, { readonly: true });

  // 3. Clear the destination, then copy each table.
  console.log("→ Clearing destination tables…");
  await sql`TRUNCATE leads, outreach, scan_jobs, settings RESTART IDENTITY CASCADE`;

  // Insert order matters: leads before outreach (foreign key).
  for (const table of ["settings", "leads", "outreach", "scan_jobs"]) {
    const rows = lite.prepare(`SELECT * FROM ${table}`).all();
    if (!rows.length) {
      console.log(`  ${table}: 0 rows`);
      continue;
    }
    // Insert in chunks to stay well under parameter limits.
    const CHUNK = 200;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      await sql`INSERT INTO ${sql(table)} ${sql(slice)}`;
    }
    console.log(`  ${table}: ${rows.length} rows copied`);
  }

  // 4. Reset identity sequences so future auto-ids don't collide with copied ids.
  for (const table of ["leads", "outreach", "scan_jobs"]) {
    await sql.unsafe(
      `SELECT setval(pg_get_serial_sequence('${table}', 'id'),
                     COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`
    );
  }

  // 5. Report final counts from Postgres.
  for (const table of ["leads", "outreach", "scan_jobs", "settings"]) {
    const [{ n }] = await sql.unsafe(`SELECT COUNT(*)::int n FROM ${table}`);
    console.log(`  ${table}: ${n} rows now in Supabase`);
  }

  lite.close();
  console.log("✓ Migration complete.");
} catch (err) {
  console.error("✗ Migration failed:", err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
