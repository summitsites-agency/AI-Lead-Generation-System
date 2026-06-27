import { NextRequest } from "next/server";
import { runScan, type ScanRequest } from "@/lib/pipeline";
import type { ScanEvent } from "@/lib/types";

// Playwright + long-running work: never statically optimized, no edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 300s is the max Vercel allows. Long Google Maps discovery scans run locally.
export const maxDuration = 300;

/**
 * POST /api/scan — runs a scan and streams newline-delimited JSON ScanEvents
 * so the scraper UI can show a live log + progress bar.
 */
export async function POST(req: NextRequest) {
  let body: ScanRequest;
  try {
    body = (await req.json()) as ScanRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Google Maps discovery drives a real browser (Playwright), which only runs on
  // your local machine. On the hosted site it's disabled — but Import / CSV and
  // the manual "Add your own lead" flow still work (they use plain HTTP scraping).
  if (body.mode === "discover" && process.env.NEXT_PUBLIC_SCRAPER_ENABLED !== "true") {
    const message =
      "Google Maps discovery runs on your computer, not the hosted site. " +
      "Use Import / CSV or “Add your own lead” here, or run a discovery scan from your local app.";
    const line = JSON.stringify({ type: "error", level: "error", message }) + "\n";
    return new Response(line, {
      headers: {
        "content-type": "application/x-ndjson; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ScanEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* client disconnected */
        }
      };
      try {
        await runScan(body, emit);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        emit({ type: "error", level: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
