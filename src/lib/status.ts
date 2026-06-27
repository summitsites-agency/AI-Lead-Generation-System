import type { LeadStatus } from "./types";

// "not_a_lead" disqualifies a row — a false positive that isn't a real business
// (directory page, duplicate, junk result). Disqualified leads are excluded from
// KPIs, the dashboard, and the campaign board, but remain in the full Leads table.
export const LEAD_STATUSES: LeadStatus[] = [
  "new",
  "contacted",
  "responded",
  "won",
  "lost",
  "not_a_lead",
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  responded: "Responded",
  won: "Won",
  lost: "Lost",
  not_a_lead: "Not a lead",
};

export const STATUS_DOT: Record<LeadStatus, string> = {
  new: "bg-primary",
  contacted: "bg-warning",
  responded: "bg-success",
  won: "bg-success",
  lost: "bg-text-muted",
  not_a_lead: "bg-danger",
};

export const DISQUALIFIED: LeadStatus = "not_a_lead";
