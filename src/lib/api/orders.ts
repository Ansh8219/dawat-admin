import { apiRequest } from "./client";
import { ApiError } from "./types";
import type {
  AdminOrder,
  AdminOrderListData,
  AdminOrderListParams,
  AdminOrderStatus,
  AdminOrderTab,
} from "./types";

function normalizeOrder(order: AdminOrder): AdminOrder {
  return {
    ...order,
    payment_method: order.payment_method ?? null,
    payment_status: order.payment_status ?? null,
    subtotal: order.subtotal ?? 0,
    discount_amount: order.discount_amount ?? 0,
    tip_amount: order.tip_amount ?? 0,
    tip_source: order.tip_source ?? null,
    applied_offer: order.applied_offer ?? null,
    distance_km: order.distance_km ?? null,
    delivery_fee: order.delivery_fee ?? null,
    total: order.total ?? null,
    fulfillment_type: order.fulfillment_type ?? null,
    table: order.table ?? null,
    customer: order.customer ?? null,
    preparation_minutes: order.preparation_minutes ?? null,
    item_count: order.item_count ?? null,
    order_code: order.order_code ?? null,
    reject_reason: order.reject_reason ?? null,
    cancelled_at: order.cancelled_at ?? null,
    cancel_reason: order.cancel_reason ?? null,
    created_at: order.created_at ?? order.ordered_at ?? "",
    ordered_at: order.ordered_at ?? order.created_at ?? null,
    delivered_at: order.delivered_at ?? null,
    waiting_seconds: order.waiting_seconds ?? null,
    delivery_status: order.delivery_status ?? null,
    driver_accepted_at: order.driver_accepted_at ?? null,
    driver: order.driver ?? null,
    address: order.address ?? null,
    pickup: order.pickup ?? null,
    businesses: order.businesses ?? [],
    items: order.items ?? [],
  };
}

export function listAdminOrders(accessToken: string, params: AdminOrderListParams) {
  const qs = new URLSearchParams();
  qs.set("tab", params.tab);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  return apiRequest<AdminOrderListData>(`/api/admin/orders/?${qs.toString()}`, {
    method: "GET",
    accessToken,
  }).then((data) => ({
    ...data,
    results: (data.results ?? []).map(normalizeOrder),
  }));
}

export function acceptAdminOrder(
  accessToken: string,
  publicId: string,
  preparationMinutes: number,
) {
  return apiRequest<AdminOrder>(`/api/admin/orders/${publicId}/accept/`, {
    method: "POST",
    accessToken,
    body: { preparation_minutes: preparationMinutes },
  }).then(normalizeOrder);
}

export function rejectAdminOrder(accessToken: string, publicId: string, reason?: string) {
  const trimmed = reason?.trim() ?? "";
  return apiRequest<AdminOrder>(`/api/admin/orders/${publicId}/reject/`, {
    method: "POST",
    accessToken,
    body: { reason: trimmed ? trimmed : null },
  }).then(normalizeOrder);
}

export function markAdminOrderReady(accessToken: string, publicId: string) {
  return apiRequest<AdminOrder>(`/api/admin/orders/${publicId}/ready/`, {
    method: "POST",
    accessToken,
  }).then(normalizeOrder);
}

export function startAdminOrderPreparing(accessToken: string, publicId: string) {
  return apiRequest<AdminOrder>(`/api/admin/orders/${publicId}/preparing/`, {
    method: "POST",
    accessToken,
  }).then(normalizeOrder);
}

/**
 * POST /api/admin/orders/{public_id}/collected/ — completes a ready app takeaway
 * order (no dining table). Status → delivered; GST invoice is issued.
 */
export function collectAdminOrder(accessToken: string, publicId: string) {
  return apiRequest<AdminOrder>(`/api/admin/orders/${publicId}/collected/`, {
    method: "POST",
    accessToken,
  }).then(normalizeOrder);
}

/**
 * POST /api/admin/orders/{public_id}/handover/ — completes a ready QR table order
 * (status → delivered). The GST invoice is issued at this moment.
 */
export function handoverAdminOrder(accessToken: string, publicId: string) {
  return apiRequest<AdminOrder>(`/api/admin/orders/${publicId}/handover/`, {
    method: "POST",
    accessToken,
  }).then(normalizeOrder);
}

/**
 * There is no GET /api/admin/orders/{public_id}/ on the backend today.
 * Callers (invoice deep-link) must handle 404 and fall back to the board.
 */
export function getAdminOrder(accessToken: string, publicId: string) {
  return apiRequest<AdminOrder>(`/api/admin/orders/${publicId}/`, {
    method: "GET",
    accessToken,
  }).then(normalizeOrder);
}

/** QR table order: placed from a dining-table QR (dine-in or counter takeaway). */
export function isQrTableOrder(order: Pick<AdminOrder, "table">): boolean {
  return Boolean(order.table);
}

/**
 * App takeaway / pickup: takeaway fulfillment with no dining table.
 * Staff mark these collected at the counter (not handover, not driver).
 */
export function isAppTakeawayOrder(order: Pick<AdminOrder, "table" | "fulfillment_type">): boolean {
  return order.fulfillment_type === "takeaway" && !order.table;
}

export function isDeliveryOrder(order: Pick<AdminOrder, "fulfillment_type">): boolean {
  return order.fulfillment_type === "delivery";
}

/** Only ready QR table orders are handed over by staff. */
export function canHandoverOrder(
  order: Pick<AdminOrder, "status" | "table" | "fulfillment_type">,
): boolean {
  return isReadyForStaffComplete(order.status) && isQrTableOrder(order);
}

/** Only ready app takeaway orders are marked collected by staff. */
export function canCollectOrder(
  order: Pick<AdminOrder, "status" | "table" | "fulfillment_type">,
): boolean {
  return isReadyForStaffComplete(order.status) && isAppTakeawayOrder(order);
}

function isReadyForStaffComplete(status: string | undefined): boolean {
  return status === "ready_for_pickup" || status === "ready";
}

export function fulfillmentLabel(type: string | null | undefined): string {
  const key = type?.trim().toLowerCase();
  if (!key) return "—";
  const known: Record<string, string> = {
    delivery: "Delivery",
    pickup: "Pickup",
    dine_in: "Dine-in",
    takeaway: "Takeaway",
  };
  return known[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** "Table T04 · Dine-in" for QR orders, else null. */
export function orderTableLabel(
  order: Pick<AdminOrder, "table" | "fulfillment_type">,
): string | null {
  if (!isQrTableOrder(order)) return null;
  const number = order.table?.table_number?.trim();
  const kind = order.fulfillment_type ? fulfillmentLabel(order.fulfillment_type) : "QR order";
  return number ? `Table ${number} · ${kind}` : kind;
}

/** Order code when present, else a short public id. */
export function orderDisplayCode(order: Pick<AdminOrder, "public_id" | "order_code">): string {
  return order.order_code?.trim() || order.public_id.slice(0, 8);
}

export function isCancelledStatus(status: string | undefined): boolean {
  return status === "cancelled";
}

/** Wallet / online orders are refunded automatically on reject; COD is not. */
export function isAutoRefundPayment(method: string | null | undefined): boolean {
  const key = method?.trim().toLowerCase();
  if (!key) return false;
  return key !== "cod" && key !== "cash";
}

/** Staff action raced a customer cancel (or another status change). */
export function isOrderStatusConflict(err: unknown): boolean {
  return err instanceof ApiError && err.code === "invalid_order_status";
}

export function formatCancelledAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `Cancelled at ${time}`;
}

export function orderCustomerName(order: AdminOrder): string {
  return order.customer?.full_name?.trim() || order.address?.full_name?.trim() || "Customer";
}

export function orderPhone(order: AdminOrder): string {
  const fromAddress = order.address?.phone?.trim();
  if (fromAddress) return fromAddress;
  const code = order.customer?.country_code?.trim() ?? "";
  const number = order.customer?.phone_number?.trim() ?? "";
  const combined = `${code}${number}`.trim();
  return combined || "—";
}

export function orderAddressLine(order: AdminOrder): string {
  const address = order.address;
  if (!address) return "";
  return [address.house_flat, address.landmark, address.formatted_address]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

export function orderItemCount(order: AdminOrder): number {
  if (order.item_count != null) return order.item_count;
  return (order.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

/** Admin-facing "new" tab status (DB `new` is mapped to `placed`). */
export function isPlacedStatus(status: string | undefined): boolean {
  return status === "placed" || status === "new";
}

export function isReadyTrackStatus(status: string | undefined): boolean {
  return (
    status === "ready" ||
    status === "ready_for_pickup" ||
    status === "driver_assigned" ||
    status === "driver_at_restaurant" ||
    status === "picked_up" ||
    status === "on_the_way"
  );
}

/** Live clock belongs on new and preparing only. Past `waiting_seconds` is null. */
export function showsSincePlacedClock(tab: AdminOrderTab): boolean {
  return tab === "new" || tab === "preparing";
}

export function sincePlacedSeconds(
  order: Pick<AdminOrder, "created_at" | "ordered_at" | "waiting_seconds">,
  now: number,
  loadedAt: number,
): number | null {
  const raw = order.created_at || order.ordered_at;
  const created = raw ? new Date(raw).getTime() : NaN;
  if (!Number.isNaN(created)) {
    return Math.max(0, Math.floor((now - created) / 1000));
  }
  if (order.waiting_seconds == null) return null;
  return Math.max(0, order.waiting_seconds + Math.floor((now - loadedAt) / 1000));
}

export function orderBillTotal(order: Pick<AdminOrder, "total" | "subtotal">): number {
  return order.total ?? order.subtotal ?? 0;
}

export function formatOrderMoney(amount: number): string {
  return "₹" + amount.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

export function paymentLabel(method: string | null | undefined): string {
  if (!method?.trim()) return "—";
  const key = method.trim().toLowerCase();
  const known: Record<string, string> = {
    cod: "COD",
    online: "Online",
    wallet: "Wallet",
    upi: "UPI",
    card: "Card",
    cash: "Cash",
  };
  return known[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Display the API payment status. Delivery does not settle COD. */
export function paymentStatusLabel(status: string | null | undefined): string {
  const key = status?.trim().toLowerCase();
  if (!key) return "—";
  if (key === "unpaid") return "Unpaid";
  if (key === "pending") return "Pending";
  if (key === "paid") return "Paid";
  if (key === "failed") return "Failed";
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDeliveredAt(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const time = date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `Delivered at ${time}`;
}

export function orderStatusLabel(status: AdminOrderStatus | string | undefined): string {
  switch (status) {
    case "placed":
    case "new":
      return "New";
    case "accepted":
      return "Accepted";
    case "preparing":
      return "Preparing";
    case "ready":
    case "ready_for_pickup":
      return "Ready for pickup";
    case "driver_assigned":
      return "Driver accepted";
    case "driver_at_restaurant":
      return "Driver at restaurant";
    case "picked_up":
      return "Picked up";
    case "on_the_way":
      return "On the way";
    case "rejected":
      return "Rejected";
    case "delivered":
    case "past":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default: {
      const raw = status?.replace(/_/g, " ").trim();
      if (!raw) return "Unknown";
      return raw.replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
}

export function tabForStatus(status: string): AdminOrderTab | null {
  if (isPlacedStatus(status)) return "new";
  if (status === "accepted" || status === "preparing") return "preparing";
  if (isReadyTrackStatus(status)) return "ready";
  if (
    status === "rejected" ||
    status === "delivered" ||
    status === "cancelled" ||
    status === "past"
  ) {
    return "past";
  }
  return null;
}
