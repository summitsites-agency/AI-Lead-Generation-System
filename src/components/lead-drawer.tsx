"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  ExternalLink,
  Phone,
  Mail,
  MapPin,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Copy,
  Check,
  Loader2,
  AtSign,
  RefreshCw,
} from "lucide-react";
import type { Lead, OutreachMessage, OutreachType, Priority } from "@/lib/types";
import {
  fetchLead,
  generateOutreach,
  setLeadStatus,
  setLeadPriority,
  analyzeInstagram,
} from "@/lib/api";
import { ScoreBar, PriorityBadge, Pill, Button, WebPresenceBadge } from "@/components/ui";
import { LEAD_STATUSES, STATUS_LABEL } from "@/lib/status";
import { displayHost, fmt, cn } from "@/lib/utils";

const OUTREACH_TABS: { type: OutreachType; label: string }[] = [
  { type: "email", label: "Email" },
  { type: "sms", label: "SMS" },
  { type: "followup", label: "Follow-up" },
];

const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "LOW"];
const PRIORITY_ACTIVE: Record<Priority, string> = {
  HIGH: "border-success bg-success text-white",
  MEDIUM: "border-warning bg-warning text-white",
  LOW: "border-danger bg-danger text-white",
};

export function LeadDrawer({
  leadId,
  onClose,
  onStatusChange,
}: {
  leadId: number | null;
  onClose: () => void;
  onStatusChange?: (lead: Lead) => void;
}) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [outreach, setOutreach] = useState<OutreachMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (leadId == null) return;
    setLoading(true);
    setLead(null);
    fetchLead(leadId)
      .then(({ lead, outreach }) => {
        setLead(lead);
        setOutreach(outreach);
      })
      .catch(() => onClose())
      .finally(() => setLoading(false));
  }, [leadId, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = leadId != null;

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-border bg-surface shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
          >
            {loading || !lead ? (
              <DrawerSkeleton onClose={onClose} />
            ) : (
              <DrawerBody
                lead={lead}
                outreach={outreach}
                setOutreach={setOutreach}
                onClose={onClose}
                onStatusChange={(l) => {
                  setLead(l);
                  onStatusChange?.(l);
                }}
              />
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function DrawerSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="skeleton h-5 w-40 rounded" />
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X size={18} />
        </button>
      </div>
      <div className="space-y-3 p-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-4 w-full rounded" />
        ))}
      </div>
    </div>
  );
}

function DrawerBody({
  lead,
  outreach,
  setOutreach,
  onClose,
  onStatusChange,
}: {
  lead: Lead;
  outreach: OutreachMessage[];
  setOutreach: (o: OutreachMessage[]) => void;
  onClose: () => void;
  onStatusChange: (lead: Lead) => void;
}) {
  const isRealSite = lead.web_presence === "site";
  const hasLink = lead.website.startsWith("http");
  const ig = lead.meta?.instagram;
  const igHandle =
    lead.source === "instagram" ? lead.website.replace(/\/+$/, "").split("/").pop() ?? "" : "";
  const [reanalyzing, setReanalyzing] = useState(false);

  const reanalyze = async () => {
    setReanalyzing(true);
    try {
      const res = await analyzeInstagram(lead.website);
      if (res.lead) onStatusChange(res.lead);
    } finally {
      setReanalyzing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-base font-semibold">{lead.name}</h2>
            <PriorityBadge priority={lead.priority} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
            {hasLink ? (
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 hover:text-primary"
              >
                {displayHost(lead.website)} <ExternalLink size={12} />
              </a>
            ) : (
              <span className="text-warning">No website</span>
            )}
            <WebPresenceBadge presence={lead.web_presence} website={lead.website} />
            <Pill>{lead.source}</Pill>
            <Pill className={lead.engine === "ai" ? "text-primary" : undefined}>
              {lead.engine === "ai" ? "AI" : "rule-based"}
            </Pill>
            {lead.source === "instagram" && (
              <button
                onClick={reanalyze}
                disabled={reanalyzing}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-text-secondary transition-colors hover:bg-hover hover:text-text-primary disabled:opacity-50"
              >
                {reanalyzing ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <RefreshCw size={11} />
                )}
                Re-analyze
              </button>
            )}
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 text-text-muted hover:text-text-primary">
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {/* Instagram preview card */}
        {ig && (
          <section className="space-y-2">
            <SectionTitle icon={<AtSign size={14} />}>Instagram profile</SectionTitle>
            <div className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex items-center gap-3">
                {ig.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ig.avatar}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-fill text-text-muted">
                    <AtSign size={20} />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{lead.name}</div>
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    @{igHandle}
                  </a>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <IgStat label="Followers" value={ig.followers} />
                <IgStat label="Following" value={ig.following} />
                <IgStat label="Posts" value={ig.posts} />
              </div>

              {ig.bio && (
                <p className="mt-3 whitespace-pre-line text-sm text-text-secondary">{ig.bio}</p>
              )}
              {ig.externalUrl && (
                <a
                  href={ig.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 break-all text-xs text-primary hover:underline"
                >
                  <ExternalLink size={12} className="shrink-0" /> {ig.externalUrl}
                </a>
              )}
              <a
                href={lead.website}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-fill px-3 py-1.5 text-xs font-medium hover:bg-fill-strong"
              >
                <ExternalLink size={13} /> Open on Instagram
              </a>
            </div>
          </section>
        )}

        {/* Section 1 — Overview */}
        <section className="space-y-3">
          <SectionTitle icon={<Sparkles size={14} />}>Overview</SectionTitle>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Design" value={lead.design_score} suffix="/10" />
            <Metric label="SEO" value={lead.seo_score} suffix="/10" />
            <Metric label="Conversion" value={lead.conversion_score} suffix="/10" />
          </div>
          <div className="rounded-xl border border-border bg-surface-2 p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs text-text-secondary">
              <span>Lead score</span>
              <span>opportunity</span>
            </div>
            <ScoreBar score={lead.lead_score} />
          </div>
          {lead.ai_summary && (
            <p className="text-sm leading-relaxed text-text-secondary">{lead.ai_summary}</p>
          )}
          <ContactRow lead={lead} />
        </section>

        {/* Section 2 — AI Insights */}
        <section className="space-y-3">
          <SectionTitle icon={<AlertTriangle size={14} />}>AI Insights</SectionTitle>
          <InsightList
            title="Issues"
            items={lead.issues}
            tone="danger"
            icon={<AlertTriangle size={13} />}
          />
          <InsightList
            title="Opportunities"
            items={lead.opportunities}
            tone="success"
            icon={<Lightbulb size={13} />}
          />
        </section>

        {/* Section 3 — Website preview */}
        {isRealSite && (
          <section className="space-y-2">
            <SectionTitle icon={<ExternalLink size={14} />}>Website preview</SectionTitle>
            <div className="overflow-hidden rounded-xl border border-border bg-white">
              <iframe
                src={lead.website}
                title="Website preview"
                className="h-64 w-full"
                sandbox="allow-scripts allow-same-origin"
                loading="lazy"
              />
            </div>
            <p className="text-[11px] text-text-muted">
              Some sites block embedding — use “{displayHost(lead.website)}” above to open it.
            </p>
          </section>
        )}

        {/* Section 4 — Outreach */}
        <OutreachSection lead={lead} outreach={outreach} setOutreach={setOutreach} />
      </div>

      {/* Footer — priority + status */}
      <div className="space-y-2 border-t border-border p-3">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs text-text-muted">Priority</span>
          <div className="flex items-center gap-1">
            {PRIORITIES.map((p) => {
              const active = lead.priority === p;
              return (
                <button
                  key={p}
                  onClick={async () => onStatusChange(await setLeadPriority(lead.id, p))}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                    active ? PRIORITY_ACTIVE[p] : "border-border text-text-secondary hover:bg-hover"
                  )}
                >
                  {p}
                </button>
              );
            })}
            <span className="ml-1 text-[11px] text-text-muted">
              {lead.priority_locked ? "· set by you" : "· from AI score"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs text-text-muted">Status</span>
          <div className="flex flex-wrap gap-1">
          {LEAD_STATUSES.map((s) => {
            const active = lead.status === s;
            const danger = s === "not_a_lead";
            return (
              <button
                key={s}
                onClick={async () => onStatusChange(await setLeadStatus(lead.id, s))}
                title={danger ? "Mark as a false positive — hides it from KPIs & pipeline" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs transition-colors",
                  active
                    ? danger
                      ? "bg-danger text-white"
                      : "bg-primary text-white"
                    : danger
                      ? "border border-danger/40 text-danger hover:bg-danger/10"
                      : "border border-border text-text-secondary hover:bg-hover"
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
      {icon}
      {children}
    </h3>
  );
}

function Metric({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3 text-center">
      <div className="tnum text-xl font-semibold">{value}</div>
      <div className="text-[11px] text-text-muted">
        {label}
        {suffix && <span className="text-text-muted/70">{suffix}</span>}
      </div>
    </div>
  );
}

function IgStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-2">
      <div className="tnum text-sm font-semibold">{fmt(value)}</div>
      <div className="text-[11px] text-text-muted">{label}</div>
    </div>
  );
}

function ContactRow({ lead }: { lead: Lead }) {
  const items = [
    lead.phone && { icon: <Phone size={13} />, text: lead.phone, href: `tel:${lead.phone}` },
    lead.email && { icon: <Mail size={13} />, text: lead.email, href: `mailto:${lead.email}` },
    lead.address && { icon: <MapPin size={13} />, text: lead.address },
  ].filter(Boolean) as { icon: React.ReactNode; text: string; href?: string }[];
  if (!items.length) return null;
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2 text-sm text-text-secondary">
          <span className="text-text-muted">{it.icon}</span>
          {it.href ? (
            <a href={it.href} className="hover:text-primary">
              {it.text}
            </a>
          ) : (
            <span>{it.text}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function InsightList({
  title,
  items,
  tone,
  icon,
}: {
  title: string;
  items: string[];
  tone: "danger" | "success";
  icon: React.ReactNode;
}) {
  if (!items.length) return null;
  const color = tone === "danger" ? "text-danger" : "text-success";
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-text-secondary">{title}</div>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
            <span className={cn("mt-0.5 shrink-0", color)}>{icon}</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OutreachSection({
  lead,
  outreach,
  setOutreach,
}: {
  lead: Lead;
  outreach: OutreachMessage[];
  setOutreach: (o: OutreachMessage[]) => void;
}) {
  const [tab, setTab] = useState<OutreachType>("email");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState("");

  const current = outreach.find((o) => o.type === tab);

  useEffect(() => {
    setDraft(current?.message ?? "");
    setCopied(false);
  }, [tab, current?.message]);

  const generate = useCallback(async () => {
    setBusy(true);
    try {
      const msg = await generateOutreach(lead.id, tab);
      setOutreach([...outreach.filter((o) => o.type !== tab), msg]);
      setDraft(msg.message);
    } finally {
      setBusy(false);
    }
  }, [lead.id, tab, outreach, setOutreach]);

  const copy = async () => {
    await navigator.clipboard.writeText(draft).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="space-y-3">
      <SectionTitle icon={<Sparkles size={14} />}>Outreach</SectionTitle>
      <div className="flex gap-1 rounded-lg border border-border bg-surface-2 p-1">
        {OUTREACH_TABS.map((t) => (
          <button
            key={t.type}
            onClick={() => setTab(t.type)}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t.type ? "bg-primary text-white" : "text-text-secondary hover:text-text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {draft ? (
        <>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="input-glow w-full resize-y rounded-xl border border-border bg-surface-2 p-3 text-sm leading-relaxed text-text-primary"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={copy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="ghost" onClick={generate} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Regenerate
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-surface-2 p-5 text-center">
          <p className="mb-3 text-sm text-text-secondary">
            No {tab} message yet. Generate one from this lead’s issues.
          </p>
          <Button size="sm" onClick={generate} disabled={busy}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Generate {OUTREACH_TABS.find((t) => t.type === tab)?.label}
          </Button>
        </div>
      )}
    </section>
  );
}
