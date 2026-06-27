"use client";

import { useState } from "react";
import { AtSign, Loader2, Sparkles } from "lucide-react";
import { analyzeInstagram, type InstagramManual } from "@/lib/api";
import { Button } from "@/components/ui";

/** Parse "12,300" / "12.3k" loosely into an integer, or undefined. */
function looseInt(raw: string): number | undefined {
  const s = raw.trim().toLowerCase().replace(/,/g, "");
  const m = s.match(/^([\d.]+)\s*([km])?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return undefined;
  const mult = m[2] === "m" ? 1_000_000 : m[2] === "k" ? 1_000 : 1;
  return Math.round(n * mult);
}

/**
 * Analyze an Instagram profile into a Social lead. Tries to read the public
 * profile; if Instagram blocks the read, it reveals a small form so the user
 * can supply what they see and still get the full AI rundown.
 */
export function AddInstagramLead({ onAdded }: { onAdded: (leadId: number) => void }) {
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Manual-fallback state (shown when the auto-read is blocked).
  const [blockedHandle, setBlockedHandle] = useState<string | null>(null);
  const [followers, setFollowers] = useState("");
  const [posts, setPosts] = useState("");
  const [bio, setBio] = useState("");
  const [niche, setNiche] = useState("");

  const reset = () => {
    setHandle("");
    setBlockedHandle(null);
    setFollowers("");
    setPosts("");
    setBio("");
    setNiche("");
    setNote(null);
  };

  const run = async (input: string, manual?: InstagramManual) => {
    setError(null);
    setBusy(true);
    setNote(manual ? "Building the rundown…" : "Reading the profile & building the rundown…");
    try {
      const res = await analyzeInstagram(input, manual);
      if (res.lead) {
        const id = res.lead.id;
        reset();
        onAdded(id);
      } else if (res.blocked) {
        setBlockedHandle(res.handle ?? input);
        setNote(null);
      } else {
        setError(res.error ?? "Couldn't analyze that profile — check the username and try again.");
      }
    } catch {
      setError("Could not reach the analysis service.");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!handle.trim() || busy) return;
    run(handle.trim());
  };

  const submitManual = () => {
    if (!blockedHandle || busy) return;
    run(blockedHandle, {
      followers: looseInt(followers),
      posts: looseInt(posts),
      bio: bio.trim() || undefined,
      niche: niche.trim() || undefined,
    });
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5 text-sm font-medium text-text-primary sm:shrink-0">
          <AtSign size={15} className="text-primary" />
          Analyze an Instagram page
        </div>
        <input
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="@username or instagram.com/username…"
          disabled={busy}
          className="input-glow h-9 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-sm"
        />
        <Button onClick={submit} disabled={busy} className="sm:shrink-0">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {busy ? "Analyzing…" : "Analyze"}
        </Button>
      </div>

      {(error || note) && (
        <p className={`mt-2 text-xs ${error ? "text-danger" : "text-text-muted"}`}>{error ?? note}</p>
      )}

      {blockedHandle && !busy && (
        <div className="mt-3 space-y-2 rounded-lg border border-warning/25 bg-warning/[0.06] p-3">
          <p className="text-xs text-text-secondary">
            Instagram blocked the automatic read of{" "}
            <span className="font-medium text-text-primary">@{blockedHandle}</span>. Add what you can
            see on their profile and I&apos;ll still build the full rundown — or just hit Generate.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={followers}
              onChange={(e) => setFollowers(e.target.value)}
              placeholder="Followers (e.g. 12.3k)"
              className="input-glow h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-xs"
            />
            <input
              value={posts}
              onChange={(e) => setPosts(e.target.value)}
              placeholder="Posts (e.g. 340)"
              className="input-glow h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-xs"
            />
            <input
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="What they do (e.g. florist)"
              className="input-glow h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-xs"
            />
            <input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Bio (optional)"
              className="input-glow h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={submitManual}>
              <Sparkles size={14} /> Generate rundown
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
