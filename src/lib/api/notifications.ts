import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "./client";
import type {
  AdminNotification,
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
  preview: () => [...adminNotificationsKeys.all, "preview"] as const,
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

/** POST /api/admin/notifications/read-all/ */
export function markAllAdminNotificationsRead(accessToken: string) {
  return apiRequest<AdminNotificationReadAllData>("/api/admin/notifications/read-all/", {
    method: "POST",
    accessToken,
  });
}

export function notificationTypeLabel(type: AdminNotificationType | undefined): string {
  switch (type) {
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
