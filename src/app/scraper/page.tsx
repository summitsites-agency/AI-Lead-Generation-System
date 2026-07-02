"use client";

import { useEffect, useRef, useState } from "react";
import { Radar, Loader2, Square, Upload, MapPin, Briefcase } from "lucide-react";
import type { Lead, ScanEvent } from "@/lib/types";
import { streamScan } from "@/lib/api";
import { Button, Card, PriorityBadge } from "@/components/ui";
import { LeadDrawer } from "@/components/lead-drawer";
import { LeadLookup } from "@/components/lead-lookup";
import { cn, displayHost } from "@/lib/utils";

interface LogLine {
  message: string;
  level: "info" | "success" | "warn" | "error";
}

type Mode = "discover" | "import" | "byname";

const MODE_LABEL: Record<Mode, string> = {
  discover: "Google Maps",
  import: "Import / CSV",
  byname: "By name",
};

const LEVEL_COLOR: Record<LogLine["level"], string> = {
  info: "text-text-secondary",
  success: "text-success",
  warn: "text-warning",
  error: "text-danger",
};

export default function ScraperPage() {
  const [mode, setMode] = useState<Mode>("discover");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [limit, setLimit] = useState(30);
  const [facebook, setFacebook] = useState(false);
  const [importText, setImportText] = useState("");

  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);
  const [progress, setProgress] = useState(0);
  const [counts, setCounts] = useState({ found: 0, scraped: 0, failed: 0 });
  const [foundLeads, setFoundLeads] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  const appendLog = (message: string, level: LogLine["level"] = "info") => {
    setLog((prev) => [...prev, { message, level }]);
    requestAnimationFrame(() => {
      if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    });
  };

  // Google Maps discovery needs a real browser (Playwright), which can't run on
  // Vercel's serverless functions. So it's enabled everywhere (localhost, etc.)
  // and only disabled on the hosted Vercel deployment. Import / CSV works anywhere.
  // Defaults to enabled before mount to avoid a flash of the disabled state.
  const [scraperEnabled, setScraperEnabled] = useState(true);
  useEffect(() => {
    setScraperEnabled(!window.location.hostname.endsWith(".vercel.app"));
  }, []);

  const canRun =
    mode === "discover"
      ? scraperEnabled && !!industry.trim() && !!location.trim()
      : importText.trim().length > 0;

  const start = async () => {
    setRunning(true);
    setLog([]);
    setProgress(0);
    setCounts({ found: 0, scraped: 0, failed: 0 });
    setFoundLeads([]);
    appendLog(mode === "discover" ? "Starting scan…" : "Importing list…");

    const ac = new AbortController();
    abortRef.current = ac;

    const body =
      mode === "discover"
        ? { mode, industry, location, limit, facebook }
        : { mode, importText };

    try {
      await streamScan(
        body,
        (e: ScanEvent) => handleEvent(e),
        ac.signal
      );
    } catch (err) {
      if (!ac.signal.aborted) {
        appendLog(err instanceof Error ? err.message : "Scan failed", "error");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const handleEvent = (e: ScanEvent) => {
    switch (e.type) {
      case "log":
        appendLog(e.message ?? "", e.level ?? "info");
        break;
      case "progress":
        if (typeof e.progress === "number") setProgress(e.progress);
        setCounts({ found: e.found ?? 0, scraped: e.scraped ?? 0, failed: e.failed ?? 0 });
        break;
      case "lead":
        if (e.lead) setFoundLeads((prev) => [...prev, e.lead as Lead]);
        break;
      case "done":
        setProgress(1);
        appendLog("Scan complete.", "success");
        break;
      case "error":
        appendLog(e.message ?? "Error", "error");
        break;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
    appendLog("Stopped by user.", "warn");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        {/* Controls */}
        <Card className="h-fit p-5">
          <div className="mb-4 flex gap-1 rounded-lg border border-border bg-surface-2 p-1">
            {(["discover", "import", "byname"] as Mode[]).map((m) => (
              <button
                key={m}
                disabled={running}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-md px-2.5 py-2 text-xs font-medium transition-colors",
                  mode === m ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
                )}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {mode === "byname" ? (
            <LeadLookup
              onSaved={(lead) => {
                setFoundLeads((prev) => [lead, ...prev.filter((l) => l.id !== lead.id)]);
                setSelected(lead.id);
              }}
            />
          ) : mode === "discover" ? (
            <div className="space-y-3">
              {!scraperEnabled && (
                <p className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-text-secondary">
                  Google Maps discovery runs on your computer, not this hosted site.
                  Use <span className="font-medium">Import / CSV</span> here, or run a
                  discovery scan from your local app.
                </p>
              )}
              <Field label="Industry" icon={<Briefcase size={14} />}>
                <input
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="roofing, dentists, landscaping…"
                  disabled={running}
                  className="field input-glow"
                />
              </Field>
              <Field label="Location" icon={<MapPin size={14} />}>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Montreal, QC"
                  disabled={running}
                  className="field input-glow"
                />
              </Field>
              <Field label={`Max businesses: ${limit}`}>
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  disabled={running}
                  className="w-full accent-[var(--primary)]"
                />
              </Field>
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={facebook}
                  onChange={(e) => setFacebook(e.target.checked)}
                  disabled={running}
                  className="accent-[var(--primary)]"
                />
                Also search Facebook (finds pages with no real website)
              </label>
            </div>
          ) : (
            <Field label="URLs (one per line) or CSV" icon={<Upload size={14} />}>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                disabled={running}
                placeholder={"acmeroofing.ca\nbobsplumbing.com\n\n— or —\nname,website,phone\nAcme,acme.com,514-555-1234"}
                className="field input-glow resize-y"
              />
            </Field>
          )}

          {mode !== "byname" && (
          <div className="mt-4 flex gap-2">
            {running ? (
              <Button variant="danger" onClick={stop} className="flex-1">
                <Square size={15} /> Stop
              </Button>
            ) : (
              <Button onClick={start} disabled={!canRun} className="flex-1">
                <Radar size={15} /> Start scan
              </Button>
            )}
          </div>
          )}
        </Card>

        {/* Live output */}
        <div className="space-y-3">
          <ProgressBar progress={progress} counts={counts} running={running} />

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2">
              <span className="text-xs font-medium text-text-secondary">Live log</span>
              {running && <Loader2 size={13} className="animate-spin text-primary" />}
            </div>
            <div
              ref={logRef}
              className="h-56 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
            >
              {log.length === 0 ? (
                <p className="text-text-muted">
                  Configure a search and hit “Start scan” to begin.
                </p>
              ) : (
                log.map((l, i) => (
                  <div key={i} className={cn("whitespace-pre-wrap", LEVEL_COLOR[l.level])}>
                    <span className="text-text-muted">›</span> {l.message}
                  </div>
                ))
              )}
            </div>
          </Card>

          {foundLeads.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-border px-4 py-2 text-xs font-medium text-text-secondary">
                Leads found ({foundLeads.length})
              </div>
              <div className="max-h-72 divide-y divide-border/60 overflow-y-auto">
                {foundLeads
                  .slice()
                  .sort((a, b) => b.lead_score - a.lead_score)
                  .map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => setSelected(lead.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-primary/[0.06]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{lead.name}</div>
                        <div className="truncate text-xs text-text-muted">
                          {lead.website.startsWith("http") ? displayHost(lead.website) : "no website"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tnum text-sm font-semibold">{lead.lead_score}</span>
                        <PriorityBadge priority={lead.priority} />
                      </div>
                    </button>
                  ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <LeadDrawer leadId={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-xs text-text-secondary">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}

function ProgressBar({
  progress,
  counts,
  running,
}: {
  progress: number;
  counts: { found: number; scraped: number; failed: number };
  running: boolean;
}) {
  const pct = Math.round(progress * 100);
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-text-secondary">
          {running ? "Scanning…" : pct === 100 ? "Complete" : "Idle"}
        </span>
        <span className="tnum text-text-muted">
          {counts.found} found · {counts.scraped} analyzed · {counts.failed} failed
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-track">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Card>
  );
}
