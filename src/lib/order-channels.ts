import type { BusinessOrderingSwitches } from "./api/types";
import { businessTypeToPanel, getPanelMeta } from "./panel";

export type OrderChannelField = "is_delivery_open" | "is_takeaway_open" | "is_dine_in_open";
export type OrderingField = "is_accepting_orders" | OrderChannelField;

export interface OrderChannelMeta {
  field: OrderChannelField;
  label: string;
  /** Shown under the toggle: what customers lose when this channel is closed. */
  hint: string;
  /** Confirmation body when closing (business label is prepended by the caller). */
  closeWarning: string;
}

export const ORDER_CHANNELS: OrderChannelMeta[] = [
  {
    field: "is_delivery_open",
    label: "Delivery",
    hint: "App delivery orders",
    closeWarning:
      "Customers won't be able to add items for delivery or place delivery orders until you turn it back on.",
  },
  {
    field: "is_takeaway_open",
    label: "Takeaway",
    hint: "App and QR takeaway",
    closeWarning:
      "Customers won't be able to place takeaway orders from the app or QR menu until you turn it back on.",
  },
  {
    field: "is_dine_in_open",
    label: "Dine-in",
    hint: "QR table orders",
    closeWarning:
      "Guests won't be able to place QR table orders until you turn it back on. They can still switch to takeaway if it is open.",
  },
];

/** Only food businesses have order channels; banquet halls just have the master switch. */
export function hasOrderChannels(type: string | null | undefined): boolean {
  return type === "restaurant" || type === "bakery";
}

/** Coerce API values; channel fields default to open when an older backend omits them. */
export function normalizeOrdering(raw: Partial<BusinessOrderingSwitches> | null | undefined) {
  return {
    is_accepting_orders: Boolean(raw?.is_accepting_orders),
    is_delivery_open: raw?.is_delivery_open ?? true,
    is_takeaway_open: raw?.is_takeaway_open ?? true,
    is_dine_in_open: raw?.is_dine_in_open ?? true,
  } satisfies BusinessOrderingSwitches;
}

/** Channels whose own switch is off (independent of the master switch). */
export function closedChannels(
  state: Partial<BusinessOrderingSwitches>,
  type?: string | null,
): OrderChannelMeta[] {
  if (type != null && !hasOrderChannels(type)) return [];
  const s = normalizeOrdering(state);
  return ORDER_CHANNELS.filter((c) => !s[c.field]);
}

/** Short status line, e.g. "Accepting orders", "Closed", "Delivery closed". */
export function orderingStatusLabel(
  state: Partial<BusinessOrderingSwitches>,
  type?: string | null,
): { label: string; tone: "open" | "partial" | "closed" } {
  const s = normalizeOrdering(state);
  if (!s.is_accepting_orders) return { label: "Closed", tone: "closed" };
  const closed = closedChannels(s, type);
  if (closed.length === 0) return { label: "Accepting orders", tone: "open" };
  if (closed.length === ORDER_CHANNELS.length) {
    return { label: "All channels closed", tone: "closed" };
  }
  return { label: `${closed.map((c) => c.label).join(" & ")} closed`, tone: "partial" };
}

/** "Restaurant" / "Bakery" for confirmations and toasts; falls back to the business name. */
export function businessLabel(type: string | null | undefined, name?: string | null): string {
  const panel = businessTypeToPanel(type ?? "");
  if (panel) return getPanelMeta(panel).label;
  return name || "this business";
}

/** React Query key for the topbar's ordering state of one outlet. */
export const outletOrderingQueryKey = (publicId: string | undefined) => [
  "outlet-ordering",
  publicId,
];
