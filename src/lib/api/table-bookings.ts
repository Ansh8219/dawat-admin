import { apiRequest } from "./client";
import type { TableBooking, TableBookingListData, TableBookingListParams } from "./types";

export function listTableBookings(accessToken: string, params: TableBookingListParams = {}) {
  const qs = new URLSearchParams();
  if (params.date) qs.set("date", params.date);
  if (params.status) qs.set("status", params.status);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiRequest<TableBookingListData>(
    `/api/admin/table-bookings/${query ? `?${query}` : ""}`,
    {
      method: "GET",
      accessToken,
    },
  );
}

export function getTableBooking(accessToken: string, publicId: string) {
  return apiRequest<TableBooking>(`/api/admin/table-bookings/${publicId}/`, {
    method: "GET",
    accessToken,
  });
}
