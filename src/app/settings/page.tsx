"use client";

import { useEffect, useState } from "react";
import { Check, X, Loader2, Cpu } from "lucide-react";
import type { ProviderStatus } from "@/lib/ai/config";
import { fetchProviders, setProvider } from "@/lib/api";
import { Card, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const PROVIDER_META: Record<string, { name: string; envKey: string; note: string }> = {
  groq: { name: "Groq", envKey: "GROQ_API_KEY", note: "Fast, generous free tier (recommended)." },
  gemini: { name: "Google Gemini", envKey: "GEMINI_API_KEY", note: "Free tier via Google AI Studio." },
  openrouter: {
    name: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    note: "Access free community models as a fallback.",
  },
};

export default function SettingsPage() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProviders()
      .then(setProviders)
      .finally(() => setLoading(false));
  }, []);

  const choose = async (provider: string) => {
    setSaving(provider);
    try {
      setProviders(await setProvider(provider));
    } finally {
      setSaving(null);
    }
  };

  const anyConnected = providers.some((p) => p.connected);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">AI provider</h2>
        <p className="text-sm text-text-secondary">
          Choose which provider powers website analysis and outreach. Add API keys to{" "}
          <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">.env</code> and restart.
        </p>
      </div>

      {!loading && !anyConnected && (
        <div className="rounded-xl border border-warning/30 bg-warning/[0.06] p-4 text-sm text-warning">
          No API keys detected. The system still runs end-to-end using the built-in deterministic
          rule-based engine — add a key for richer AI analysis and outreach.
        </div>
      )}

      <div className="space-y-3">
        {(loading ? [] : providers).map((p) => {
          const meta = PROVIDER_META[p.provider];
          return (
            <Card
              key={p.provider}
              className={cn("p-4 transition-colors", p.active && "border-primary/50")}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/12 text-primary">
                    <Cpu size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      {meta.name}
                      {p.active && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted">{meta.note}</div>
                    <div className="mt-1 font-mono text-[11px] text-text-muted">
                      model: {p.model}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                      p.connected
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-border bg-surface-2 text-text-muted"
                    )}
                  >
                    {p.connected ? <Check size={11} /> : <X size={11} />}
                    {p.connected ? "Connected" : `set ${meta.envKey}`}
                  </span>
                  {!p.active && (
                    <Button size="sm" variant="secondary" onClick={() => choose(p.provider)} disabled={!!saving}>
                      {saving === p.provider ? <Loader2 size={13} className="animate-spin" /> : null}
                      Use this
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {loading && <div className="skeleton h-24 rounded-xl" />}
      </div>
    </div>
  );
}
