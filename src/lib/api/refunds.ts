import { apiRequest } from "./client";
import { ApiError } from "./types";
import type {
  AdminRefund,
  AdminRefundListData,
  AdminRefundListParams,
  AdminRefundRetryData,
} from "./types";

export function listAdminRefunds(accessToken: string, params: AdminRefundListParams = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiRequest<AdminRefundListData>(`/api/admin/refunds/${query ? `?${query}` : ""}`, {
    method: "GET",
    accessToken,
  });
}

export function retryAdminRefund(accessToken: string, publicId: string) {
  return apiRequest<AdminRefundRetryData>(`/api/admin/refunds/${publicId}/retry/`, {
    method: "POST",
    accessToken,
  });
}

/** Wallet refunds are instant and never retried. */
export function canRetryRefund(refund: Pick<AdminRefund, "status" | "destination">): boolean {
  return refund.status === "failed" && refund.destination === "original_payment";
}

/** Prefer `error.details.detail` from the API, then the envelope message. */
export function refundErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  const details = err.details;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    const detail = (details as Record<string, unknown>).detail;
    if (typeof detail === "string" && detail.trim()) return detail.trim();
  }
  if (typeof details === "string" && details.trim()) return details.trim();
  return err.message || fallback;
}

export function refundDestinationLabel(destination: string): string {
  if (destination === "wallet") return "Wallet";
  if (destination === "original_payment") return "Original payment";
  return destination.replace(/_/g, " ") || "—";
}

export function refundReasonLabel(reason: string): string {
  if (reason === "customer_cancelled") return "Customer cancelled";
  if (reason === "restaurant_rejected") return "Restaurant rejected";
  return reason.replace(/_/g, " ") || "—";
}

export function refundStatusLabel(status: string): string {
  if (status === "pending") return "Pending";
  if (status === "processed") return "Processed";
  if (status === "failed") return "Failed";
  return status || "—";
}
