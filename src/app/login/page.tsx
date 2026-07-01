"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2, Mountain } from "lucide-react";
import { Button, Card } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Incorrect password. Try again.");
        setBusy(false);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-text-primary">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
            <Mountain size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Summit Sites</div>
            <div className="text-[11px] text-text-muted">Lead Intelligence</div>
          </div>
        </div>

        <label className="mb-1.5 flex items-center gap-1.5 text-xs text-text-secondary">
          <Lock size={14} /> Access password
        </label>
        <input
          type="password"
          value={password}
          autoFocus
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Enter password…"
          className="field input-glow mb-3"
        />
        {error && <p className="mb-3 text-xs text-danger">{error}</p>}
        <Button onClick={submit} disabled={busy || !password} className="w-full">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </Card>
    </div>
  );
}
