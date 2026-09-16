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
    preparation_minutes: order.preparation_minutes ?? null,
    reject_reason: order.reject_reason ?? null,
    waiting_seconds: order.waiting_seconds ?? null,
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

export function rejectAdminOrder(
  accessToken: string,
  publicId: string,
  reason?: string,
) {
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

export function orderStatusLabel(status: AdminOrderStatus | string | undefined): string {
  switch (status) {
    case "new":
      return "New";
    case "preparing":
      return "Preparing";
    case "ready":
      return "Ready";
    case "rejected":
      return "Rejected";
    case "delivered":
      return "Delivered";
    default:
      return status?.trim() || "Unknown";
  }
}

export function tabForStatus(status: string): AdminOrderTab | null {
  if (status === "new" || status === "preparing" || status === "ready") return status;
  if (status === "rejected" || status === "delivered") return "past";
  return null;
}
