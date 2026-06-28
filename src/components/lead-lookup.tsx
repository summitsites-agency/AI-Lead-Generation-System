"use client";

import { useState } from "react";
import { Search, Loader2, Building2, MapPin, ArrowLeft, Check } from "lucide-react";
import type { Lead } from "@/lib/types";
import {
  lookupCompany,
  saveManualLead,
  type LookupCandidate,
  type ManualLeadInput,
} from "@/lib/api";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

type Step = "search" | "pick" | "confirm";

const EMPTY: ManualLeadInput = {
  name: "",
  city: "",
  website: "",
  phone: "",
  email: "",
  address: "",
  industry: "",
};

/**
 * Add a lead from just a company name. Searches OpenStreetMap (no browser) for
 * real contact data, lets the user pick a match (or enter manually), then
 * confirm a pre-filled form with the gaps highlighted.
 */
export function LeadLookup({ onSaved }: { onSaved: (lead: Lead) => void }) {
  const [step, setStep] = useState<Step>("search");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState<LookupCandidate[]>([]);
  const [draft, setDraft] = useState<ManualLeadInput>(EMPTY);
  const [missing, setMissing] = useState<string[]>([]);

  const reset = () => {
    setStep("search");
    setCandidates([]);
    setDraft(EMPTY);
    setMissing([]);
    setError("");
  };

  const search = async () => {
    if (!name.trim() || !city.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await lookupCompany(name.trim(), city.trim());
      if (res.error) {
        setError(res.error);
        return;
      }
      const found = res.candidates ?? [];
      setCandidates(found);
      if (found.length === 0) {
        // Nothing found — drop straight to manual entry.
        chooseManual();
      } else {
        setStep("pick");
      }
    } catch {
      setError("Lookup failed. Check your connection or enter details manually.");
    } finally {
      setBusy(false);
    }
  };

  const choose = (c: LookupCandidate) => {
    setDraft({
      name: c.name || name.trim(),
      city: city.trim(),
      website: c.website,
      phone: c.phone,
      email: c.email,
      address: c.address,
      industry: c.industry,
    });
    setMissing(c.missing ?? []);
    setStep("confirm");
  };

  const chooseManual = () => {
    setDraft({ ...EMPTY, name: name.trim(), city: city.trim() });
    setMissing(["phone", "email", "address"]);
    setStep("confirm");
  };

  const save = async () => {
    if (!draft.name.trim() || !draft.city.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await saveManualLead(draft);
      if (res.error || !res.lead) {
        setError(res.error ?? "Could not save lead.");
        return;
      }
      onSaved(res.lead);
      setName("");
      setCity("");
      reset();
    } catch {
      setError("Could not save lead.");
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof ManualLeadInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [k]: e.target.value }));

  if (step === "search") {
    return (
      <div className="space-y-3">
        <p className="text-xs text-text-secondary">
          For leads with no website or socials — type a company name and we&apos;ll
          find what we can, then you fill the rest.
        </p>
        <Field label="Company name" icon={<Building2 size={14} />}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Plumbing"
            className="input-glow h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm"
          />
        </Field>
        <Field label="City" icon={<MapPin size={14} />}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Denver, CO"
            className="input-glow h-9 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm"
          />
        </Field>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button onClick={search} disabled={busy || !name.trim() || !city.trim()} className="w-full">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          Find company
        </Button>
      </div>
    );
  }

  if (step === "pick") {
    return (
      <div className="space-y-3">
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft size={13} /> New search
        </button>
        <p className="text-xs text-text-secondary">Pick the right match:</p>
        <div className="space-y-2">
          {candidates.map((c, i) => (
            <button
              key={i}
              onClick={() => choose(c)}
              className="block w-full rounded-lg border border-border bg-surface-2 p-2.5 text-left transition-colors hover:border-primary/60"
            >
              <div className="truncate text-sm font-medium">{c.name}</div>
              {c.address && (
                <div className="truncate text-xs text-text-muted">{c.address}</div>
              )}
            </button>
          ))}
          <button
            onClick={chooseManual}
            className="block w-full rounded-lg border border-dashed border-border p-2.5 text-left text-sm text-text-secondary transition-colors hover:border-primary/60"
          >
            None of these — enter manually
          </button>
        </div>
      </div>
    );
  }

  // confirm
  return (
    <div className="space-y-3">
      <button
        onClick={() => setStep(candidates.length ? "pick" : "search")}
        className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft size={13} /> Back
      </button>
      {missing.length > 0 && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 p-2.5 text-xs text-text-secondary">
          We couldn&apos;t find: <span className="font-medium">{missing.join(", ")}</span>.
          Fill in what you know.
        </p>
      )}
      <DraftField label="Company name" value={draft.name} onChange={set("name")} />
      <DraftField label="City" value={draft.city} onChange={set("city")} />
      <DraftField
        label="Industry"
        value={draft.industry}
        onChange={set("industry")}
        gap={missing.includes("industry")}
      />
      <DraftField
        label="Phone"
        value={draft.phone}
        onChange={set("phone")}
        gap={missing.includes("phone")}
      />
      <DraftField
        label="Email"
        value={draft.email}
        onChange={set("email")}
        gap={missing.includes("email")}
      />
      <DraftField
        label="Address"
        value={draft.address}
        onChange={set("address")}
        gap={missing.includes("address")}
      />
      <DraftField
        label="Website (if any)"
        value={draft.website}
        onChange={set("website")}
      />
      {error && <p className="text-xs text-danger">{error}</p>}
      <Button onClick={save} disabled={busy || !draft.name.trim()} className="w-full">
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
        Save lead
      </Button>
    </div>
  );
}

function DraftField({
  label,
  value,
  onChange,
  gap,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  gap?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        value={value}
        onChange={onChange}
        className={cn(
          "input-glow h-9 w-full rounded-lg border bg-surface-2 px-3 text-sm",
          gap ? "border-warning/60" : "border-border"
        )}
      />
    </Field>
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
