"use client";

import { useState } from "react";
import { Plus, Loader2, Sparkles } from "lucide-react";
import { streamScan } from "@/lib/api";
import { normalizeUrl } from "@/lib/utils";
import { Button } from "@/components/ui";
import type { Lead } from "@/lib/types";

/**
 * Manually add a lead by URL. Runs the exact same pipeline as discovery
 * (scrape → AI analysis → scoring → store) on a single site, then opens it.
 */
export function AddLead({ onAdded }: { onAdded: (leadId: number) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNote(null);
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError("Enter a valid website, e.g. acmeroofing.ca");
      return;
    }

    setBusy(true);
    setNote("Scraping & analyzing the site…");
    let leadId: number | null = null;
    let failMsg: string | null = null;
    try {
      await streamScan({ mode: "import", importText: normalized }, (e) => {
        if (e.type === "lead" && e.lead) leadId = (e.lead as Lead).id;
        else if (e.type === "error") failMsg = e.message ?? "Scan failed";
      });
    } catch {
      failMsg = "Could not reach the analysis service";
    } finally {
      setBusy(false);
      setNote(null);
    }

    if (leadId != null) {
      setUrl("");
      onAdded(leadId);
    } else {
      setError(failMsg ?? "Couldn't analyze that site — check the URL and try again.");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 text-sm font-medium text-text-primary sm:shrink-0">
          <Plus size={15} className="text-primary" />
          Add your own lead
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && submit()}
          placeholder="Paste a website URL…"
          disabled={busy}
          className="input-glow h-9 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm"
        />
        <Button onClick={submit} disabled={busy} className="sm:shrink-0">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? "Analyzing…" : "Scan & analyze"}
        </Button>
      </div>
      {(error || note) && (
        <p className={`mt-2 text-xs ${error ? "text-danger" : "text-text-muted"}`}>{error ?? note}</p>
      )}
    </div>
  );
}
