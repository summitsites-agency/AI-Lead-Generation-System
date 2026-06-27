// Browser-side typed fetch helpers. (No "server-only" — used by client components.)
import type {
  Lead,
  LeadStatus,
  OutreachMessage,
  OutreachType,
  ScanEvent,
} from "@/lib/types";
import type { Stats } from "@/lib/db/leads";
import type { ProviderStatus } from "@/lib/ai/config";
import type { ScanJob } from "@/lib/types";

export interface LeadQuery {
  priority?: string;
  status?: string;
  industry?: string;
  search?: string;
  sort?: string;
  /** hide leads marked "not a lead" */
  hideDisqualified?: boolean;
  /** filter by web presence; "no_site" = no real website (the new-build pool) */
  presence?: string;
}

export async function fetchLeads(q: LeadQuery = {}): Promise<Lead[]> {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v === true) sp.set(k, "1");
    else if (v) sp.set(k, String(v));
  }
  const res = await fetch(`/api/leads?${sp.toString()}`, { cache: "no-store" });
  const data = await res.json();
  return data.leads ?? [];
}

export interface InstagramManual {
  followers?: number;
  posts?: number;
  bio?: string;
  niche?: string;
}

export interface InstagramResult {
  lead?: Lead;
  blocked?: boolean;
  handle?: string;
  error?: string;
}

/** Analyze an Instagram handle into a Social lead (server scrapes + AI rundown). */
export async function analyzeInstagram(
  handle: string,
  manual?: InstagramManual
): Promise<InstagramResult> {
  const res = await fetch("/api/instagram", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ handle, manual }),
  });
  return res.json();
}

export async function fetchLead(
  id: number
): Promise<{ lead: Lead; outreach: OutreachMessage[] }> {
  const res = await fetch(`/api/leads/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error("lead not found");
  return res.json();
}

export async function setLeadStatus(id: number, status: LeadStatus): Promise<Lead> {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  return data.lead;
}

/** Manually set a lead's priority (overrides the AI's choice and locks it). */
export async function setLeadPriority(id: number, priority: string): Promise<Lead> {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ priority }),
  });
  const data = await res.json();
  return data.lead;
}

export async function generateOutreach(
  leadId: number,
  type: OutreachType
): Promise<OutreachMessage> {
  const res = await fetch("/api/outreach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ leadId, type }),
  });
  const data = await res.json();
  return data.message;
}

export async function fetchStats(): Promise<{ stats: Stats; recentScans: ScanJob[] }> {
  const res = await fetch("/api/stats", { cache: "no-store" });
  return res.json();
}

export interface ProvidersResponse {
  providers: ProviderStatus[];
}

export async function fetchProviders(): Promise<ProviderStatus[]> {
  const res = await fetch("/api/settings", { cache: "no-store" });
  const data = (await res.json()) as ProvidersResponse;
  return data.providers ?? [];
}

export async function setProvider(provider: string, model?: string): Promise<ProviderStatus[]> {
  const res = await fetch("/api/settings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider, model }),
  });
  const data = (await res.json()) as ProvidersResponse;
  return data.providers ?? [];
}

/**
 * Start a scan and stream ScanEvents as they arrive (NDJSON).
 * Calls `onEvent` for each parsed event; resolves when the stream ends.
 */
export async function streamScan(
  body: unknown,
  onEvent: (e: ScanEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.body) throw new Error("no stream");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        onEvent(JSON.parse(trimmed) as ScanEvent);
      } catch {
        /* ignore partial/garbage line */
      }
    }
  }
}
