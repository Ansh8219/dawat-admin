import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "./client";
import type {
  AdminNotification,
  BusinessType,
  PendingSummaryData,
  AdminNotificationListData,
  AdminNotificationListParams,
  AdminNotificationReadAllData,
  AdminNotificationReadData,
  AdminNotificationType,
  AdminNotificationUnreadCountData,
} from "./types";

/** TanStack Query keys for the admin notifications inbox. */
export const adminNotificationsKeys = {
  all: ["admin-notifications"] as const,
  unreadCount: () => [...adminNotificationsKeys.all, "unread-count"] as const,
  list: (params: AdminNotificationListParams) =>
    [...adminNotificationsKeys.all, "list", params] as const,
  preview: (businessType: BusinessType | "all" = "all") =>
    [...adminNotificationsKeys.all, "preview", businessType] as const,
};

/** Open work per business (new orders, counter payments, hall enquiries, stock). */
export const pendingSummaryKeys = {
  all: ["pending-summary"] as const,
};

/** GET /api/admin/notifications/ */
export function listAdminNotifications(
  accessToken: string,
  params: AdminNotificationListParams = {},
) {
  const qs = new URLSearchParams();
  if (params.is_read != null) qs.set("is_read", String(params.is_read));
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  if (params.business_type) qs.set("business_type", params.business_type);
  const query = qs.toString();
  return apiRequest<AdminNotificationListData>(
    `/api/admin/notifications/${query ? `?${query}` : ""}`,
    { method: "GET", accessToken },
  );
}

/** GET /api/admin/notifications/unread-count/ */
export function getAdminNotificationsUnreadCount(accessToken: string) {
  return apiRequest<AdminNotificationUnreadCountData>("/api/admin/notifications/unread-count/", {
    method: "GET",
    accessToken,
  });
}

/** POST /api/admin/notifications/{public_id}/read/ */
export function markAdminNotificationRead(accessToken: string, publicId: string) {
  return apiRequest<AdminNotificationReadData>(`/api/admin/notifications/${publicId}/read/`, {
    method: "POST",
    accessToken,
  });
}

/** POST /api/admin/notifications/read-all/ — optionally only one business. */
export function markAllAdminNotificationsRead(accessToken: string, businessType?: BusinessType) {
  const query = businessType ? `?business_type=${encodeURIComponent(businessType)}` : "";
  return apiRequest<AdminNotificationReadAllData>(`/api/admin/notifications/read-all/${query}`, {
    method: "POST",
    accessToken,
  });
}

/** GET /api/admin/pending-summary/ */
export function getPendingSummary(accessToken: string) {
  return apiRequest<PendingSummaryData>("/api/admin/pending-summary/", {
    method: "GET",
    accessToken,
  });
}

/** Where a notification should take the admin (business + page). */
export type NotificationTarget = {
  businessPublicId: string | null;
  businessType: BusinessType | null;
  to: string;
  search?: Record<string, string>;
};

export function notificationTarget(n: AdminNotification): NotificationTarget {
  const base = {
    businessPublicId: n.business_public_id ?? null,
    businessType: n.business_type ?? null,
  };
  const entity = n.data?.entity_type;
  const id = typeof n.data?.entity_id === "string" ? n.data.entity_id : undefined;
  if (n.type === "counter_payment") return { ...base, to: "/pos", search: { tab: "counter" } };
  switch (entity) {
    case "order":
      return { ...base, to: "/orders" };
    case "hall_enquiry":
      return { ...base, to: "/hall-enquiries" };
    case "hall_booking":
      return { ...base, to: "/hall-bookings" };
    case "inventory_item":
      return { ...base, to: "/inventory", search: id ? { item: id } : undefined };
    default:
      return { ...base, to: "/notifications" };
  }
}

export function notificationTypeLabel(type: AdminNotificationType | undefined): string {
  switch (type) {
    case "order_new":
      return "New order";
    case "order_cancelled":
      return "Cancelled";
    case "counter_payment":
      return "Counter payment";
    case "hall_enquiry":
      return "Hall enquiry";
    case "hall_booking":
      return "Hall booking";
    case "stock":
      return "Stock";
    case "purchase":
      return "Purchase";
    case "account":
      return "Account";
    case "system":
      return "System";
    case "wallet":
      return "Wallet";
    default:
      return type?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Alert";
  }
}

export function formatNotificationTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatUnreadBadge(count: number): string | null {
  if (count <= 0) return null;
  if (count > 99) return "99+";
  return String(count);
}

export function isUnreadNotification(n: Pick<AdminNotification, "is_read">): boolean {
  return !n.is_read;
}
