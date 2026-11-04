import { apiRequest } from "./client";
import { ApiError } from "./types";

export type HallBookingStatus =
  | "pending_payment"
  | "pending_approval"
  | "confirmed"
  | "completed"
  | "no_show"
  | "rejected"
  | "expired";

export const HALL_BOOKING_STATUSES: HallBookingStatus[] = [
  "pending_payment",
  "pending_approval",
  "confirmed",
  "completed",
  "no_show",
  "rejected",
  "expired",
];

export const HALL_BOOKING_STATUS_LABELS: Record<HallBookingStatus, string> = {
  pending_payment: "Pending payment",
  pending_approval: "Pending approval",
  confirmed: "Confirmed",
  completed: "Completed",
  no_show: "No-show",
  rejected: "Rejected",
  expired: "Expired",
};

export type HallRefundStatus = "pending" | "processed" | "failed";

export interface HallBookingRow {
  public_id: string;
  status: HallBookingStatus;
  /** YYYY-MM-DD */
  booking_date: string;
  slot: { code: string; label: string; start_time: string; end_time: string };
  guests: number;
  occasion: string | null;
  note: string | null;
  /** Rupees, decimal string. */
  advance_amount: string;
  contact_name: string;
  contact_phone: string;
  hall: { public_id: string; name: string; category: string; image: string | null };
  paid_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  refund_status: HallRefundStatus | null;
  refund_amount: string | null;
  admin_note: string | null;
  created_at: string;
  customer_public_id?: string;
  refunded_at?: string | null;
  updated_at?: string;
}

export interface HallBookingListParams {
  status?: HallBookingStatus;
  date?: string;
  from?: string;
  to?: string;
  when?: "upcoming" | "past";
  q?: string;
  hall_public_id?: string;
  page?: number;
  page_size?: number;
}

export interface HallBookingListData {
  count: number;
  page: number;
  page_size: number;
  results: HallBookingRow[];
}

export interface HallDashboardData {
  cards: {
    pending_approvals: number;
    today_bookings: number;
    upcoming_week: number;
    approved_this_month: number;
    new_enquiries: number;
  };
  money: { month_start: string; advance_collected: string; refunded: string };
  status_breakdown: Record<HallBookingStatus, number>;
  upcoming: HallBookingRow[];
  halls: {
    public_id: string;
    name: string;
    is_active: boolean;
    bookings_this_month: number;
    advance_this_month: string;
  }[];
  daily_load: { date: string; bookings: number }[];
}

export function isForbidden(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.code !== "password_change_required";
}

export function getHallDashboard(accessToken: string) {
  return apiRequest<HallDashboardData>("/api/admin/halls/dashboard/", { accessToken });
}

export function listHallBookings(accessToken: string, params: HallBookingListParams) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const query = qs.toString();
  return apiRequest<HallBookingListData>(`/api/admin/hall-bookings/${query ? `?${query}` : ""}`, {
    accessToken,
  });
}

const one = "/api/admin/hall-bookings";

export function getHallBooking(accessToken: string, id: string) {
  return apiRequest<HallBookingRow>(`${one}/${id}/`, { accessToken });
}

export function approveHallBooking(accessToken: string, id: string, adminNote?: string) {
  return apiRequest<HallBookingRow>(`${one}/${id}/approve/`, {
    method: "POST",
    accessToken,
    body: adminNote ? { admin_note: adminNote } : {},
  });
}

export function rejectHallBooking(
  accessToken: string,
  id: string,
  body: { reason: string; admin_note?: string },
) {
  return apiRequest<HallBookingRow>(`${one}/${id}/reject/`, {
    method: "POST",
    accessToken,
    body,
  });
}

export function completeHallBooking(accessToken: string, id: string) {
  return apiRequest<HallBookingRow>(`${one}/${id}/complete/`, {
    method: "POST",
    accessToken,
    body: {},
  });
}

export function noShowHallBooking(accessToken: string, id: string) {
  return apiRequest<HallBookingRow>(`${one}/${id}/no-show/`, {
    method: "POST",
    accessToken,
    body: {},
  });
}

export function saveHallBookingNote(accessToken: string, id: string, adminNote: string) {
  return apiRequest<HallBookingRow>(`${one}/${id}/`, {
    method: "PATCH",
    accessToken,
    body: { admin_note: adminNote },
  });
}

export function retryHallRefund(accessToken: string, id: string) {
  return apiRequest<HallBookingRow>(`${one}/${id}/retry-refund/`, {
    method: "POST",
    accessToken,
    body: {},
  });
}

/* ---------- formatting helpers ---------- */

export function formatInr(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return `₹${v}`;
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** "2026-11-12" → "Thu, 12 Nov 2026" (no timezone shifting). */
export function formatDay(iso: string | null | undefined, withYear = true): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

export function formatMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return iso;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
