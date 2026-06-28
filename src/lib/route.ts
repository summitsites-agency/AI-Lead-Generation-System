import { NextResponse } from "next/server";

/**
 * Wraps an API route handler so any thrown error (a database hiccup, an AI
 * provider outage, an unexpected null) becomes a clean JSON 500 instead of an
 * unhandled crash. The client always gets parseable JSON back, and the failure
 * is logged server-side for debugging.
 *
 * Usage: `export const GET = safeRoute(async (req) => { ... })`.
 */
export function safeRoute<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[api] unhandled route error:", detail);
      return NextResponse.json(
        { error: "Something went wrong on the server. Please try again." },
        { status: 500 }
      );
    }
  };
}
