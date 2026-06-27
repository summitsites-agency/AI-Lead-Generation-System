import "server-only";
import postgres from "postgres";

/**
 * Shared Postgres (Supabase) connection for the Node server. Next.js may
 * re-evaluate modules during dev HMR, and serverless functions reuse warm
 * instances, so cache the client on globalThis to avoid opening a new pool
 * on every module evaluation.
 *
 * The schema lives in `supabase/schema.sql` and is applied once to the
 * database (via `npm run migrate:supabase` or the Supabase SQL editor) rather
 * than on every connection.
 */
declare global {
  // eslint-disable-next-line no-var
  var __leadgenSql: ReturnType<typeof postgres> | undefined;
}

function create(): ReturnType<typeof postgres> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Supabase pooled (Transaction) connection " +
        "string to .env locally and to the Vercel project settings."
    );
  }

  return postgres(url, {
    // Supabase's Transaction pooler (pgBouncer) does NOT support prepared
    // statements — this MUST be false or queries fail intermittently.
    prepare: false,
    // Supabase requires TLS.
    ssl: "require",
    // Keep the per-instance pool small; the pooler multiplexes server-side.
    max: 5,
    idle_timeout: 20,
    // Return date/timestamp columns as raw strings (not JS Date objects) so the
    // rest of the app keeps treating `created_at` as an opaque string, exactly
    // as it did under SQLite.
    types: {
      date: {
        to: 1184,
        from: [1082, 1083, 1114, 1184],
        serialize: (x: unknown) => x as string,
        parse: (x: string) => x,
      },
    },
  });
}

/** The shared tagged-template SQL client. Query helpers await this. */
export function getSql(): ReturnType<typeof postgres> {
  if (!globalThis.__leadgenSql) {
    globalThis.__leadgenSql = create();
  }
  return globalThis.__leadgenSql;
}
