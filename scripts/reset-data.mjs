import { readFileSync } from "node:fs";
import postgres from "postgres";

// Load DATABASE_URL straight from .env (standalone script, no Next.js env loading).
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const line = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
const url = line?.slice("DATABASE_URL=".length).trim();
if (!url) throw new Error("DATABASE_URL not found in .env");

// Safety guard: only ever run against the project the user authorized.
const EXPECTED_REF = "jpywqhhzxivdtkynqaen";
if (!url.includes(EXPECTED_REF)) {
  throw new Error(
    `Refusing to run: DATABASE_URL does not target ${EXPECTED_REF}. Aborting.`
  );
}

const sql = postgres(url, { prepare: false, ssl: "require", max: 1 });

const tables = ["leads", "outreach", "scan_jobs"];

async function counts(label) {
  const out = {};
  for (const t of tables) {
    const [{ c }] = await sql`SELECT count(*)::int c FROM ${sql(t)}`;
    out[t] = c;
  }
  console.log(`${label}:`, out);
}

await counts("BEFORE");
// FK-safe: CASCADE handles outreach->leads; RESTART IDENTITY resets serial ids.
await sql`TRUNCATE leads, outreach, scan_jobs RESTART IDENTITY CASCADE`;
await counts("AFTER ");
console.log("settings table left untouched.");
await sql.end();
