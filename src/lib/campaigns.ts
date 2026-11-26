import { format } from "date-fns";
import type { CampaignAudienceType, CampaignOfferRef, CampaignStatus } from "@/lib/api/types";

export const AUDIENCE_OPTIONS: {
  value: CampaignAudienceType;
  label: string;
  help: string;
  needsDays: boolean;
}[] = [
  {
    value: "all_customers",
    label: "All customers",
    help: "Every active customer.",
    needsDays: false,
  },
  {
    value: "ordered_within_days",
    label: "Ordered recently",
    help: "Customers who ordered in the last N days.",
    needsDays: true,
  },
  {
    value: "inactive_for_days",
    label: "Inactive customers",
    help: "Customers with no order in the last N days (includes never ordered).",
    needsDays: true,
  },
  {
    value: "new_within_days",
    label: "New customers",
    help: "Customers who signed up in the last N days.",
    needsDays: true,
  },
];

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  scheduled: "Scheduled",
  sending: "Sending",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const STATUS_CLASSES: Record<CampaignStatus, string> = {
  scheduled: "bg-info/15 text-info border-info/30",
  sending: "bg-warning/15 text-warning border-warning/40",
  completed: "bg-success/15 text-success border-success/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export const TERMINAL_STATUSES: readonly CampaignStatus[] = ["completed", "failed", "cancelled"];

export function audienceLabel(type: CampaignAudienceType, days: number | null): string {
  const opt = AUDIENCE_OPTIONS.find((o) => o.value === type);
  if (!opt) return type;
  return opt.needsDays && days ? `${opt.label} · ${days}d` : opt.label;
}

/** Friendly text for a recipient `error` code. */
export function recipientErrorLabel(error: string | null): string {
  if (!error) return "—";
  switch (error) {
    case "no_device":
      return "No app installed / push token";
    case "fcm_not_configured":
      return "Push (FCM) not configured";
    case "push_failed":
      return "Push delivery failed";
    default:
      // Historical rows from before campaigns became push only.
      if (error === "no_phone" || error.startsWith("whatsapp_")) return "Old WhatsApp delivery";
      return error;
  }
}

/** ISO string → value for <input type="datetime-local"> in the admin's local timezone. */
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

/** datetime-local value (local time) → ISO-8601 UTC string. */
export function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "dd MMM yyyy, hh:mm a");
}

/** Substitute {name}/{offer_title}/{offer_code} with sample values for the live preview. */
export function renderPlaceholders(text: string, offer: CampaignOfferRef | null): string {
  return text
    .replace(/\{name\}/g, "Aisha")
    .replace(/\{offer_title\}/g, offer?.title ?? "")
    .replace(/\{offer_code\}/g, offer?.code ?? "");
}
