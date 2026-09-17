import { apiRequest } from "./client";
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
    distance_km: order.distance_km ?? null,
    delivery_fee: order.delivery_fee ?? null,
    total: order.total ?? null,
    preparation_minutes: order.preparation_minutes ?? null,
    reject_reason: order.reject_reason ?? null,
    delivered_at: order.delivered_at ?? null,
    waiting_seconds: order.waiting_seconds ?? null,
    delivery_status: order.delivery_status ?? null,
    driver_accepted_at: order.driver_accepted_at ?? null,
    driver: order.driver ?? null,
    address: order.address ?? null,
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
    body: trimmed ? { reason: trimmed } : {},
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

export function orderCustomerName(order: AdminOrder): string {
  return order.address?.full_name?.trim() || "Customer";
}

export function orderPhone(order: AdminOrder): string {
  return order.address?.phone?.trim() || "—";
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
  return (order.items ?? []).reduce((sum, item) => sum + (item.quantity || 0), 0);
}

export function isPlacedStatus(status: string | undefined): boolean {
  return status === "placed";
}

export function isReadyTrackStatus(status: string | undefined): boolean {
  return (
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
  order: Pick<AdminOrder, "created_at" | "waiting_seconds">,
  now: number,
  loadedAt: number,
): number | null {
  const created = new Date(order.created_at).getTime();
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
  if (key === "paid") return "Paid";
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
      return "Placed";
    case "accepted":
      return "Accepted";
    case "preparing":
      return "Preparing";
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
      return "Delivered";
    default:
      return status?.replace(/_/g, " ").trim() || "Unknown";
  }
}

export function tabForStatus(status: string): AdminOrderTab | null {
  if (isPlacedStatus(status)) return "new";
  if (status === "accepted" || status === "preparing") return "preparing";
  if (isReadyTrackStatus(status)) return "ready";
  if (status === "rejected" || status === "delivered") return "past";
  return null;
}
