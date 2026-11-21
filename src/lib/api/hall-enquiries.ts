import { apiRequest } from "./client";

export type HallEnquiryStatus = "new" | "contacted" | "approved" | "rejected" | "closed";

export const HALL_ENQUIRY_STATUSES: HallEnquiryStatus[] = [
  "new",
  "contacted",
  "approved",
  "rejected",
  "closed",
];

export const HALL_ENQUIRY_STATUS_LABELS: Record<HallEnquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  approved: "Approved",
  rejected: "Rejected",
  closed: "Closed",
};

export const REJECTION_REASON_MAX = 500;

export interface HallEnquiry {
  public_id: string;
  name: string;
  phone: string;
  hall: { public_id: string; name: string } | null;
  /** YYYY-MM-DD */
  preferred_date: string | null;
  guests: number | null;
  message: string | null;
  status: HallEnquiryStatus;
  /** Only set when status = rejected. */
  rejection_reason: string | null;
  created_at: string;
}

export interface HallEnquiryListParams {
  status?: HallEnquiryStatus;
  page?: number;
  page_size?: number;
}

export interface HallEnquiryListData {
  count: number;
  page: number;
  page_size: number;
  results: HallEnquiry[];
}

export function listHallEnquiries(accessToken: string, params: HallEnquiryListParams) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const query = qs.toString();
  return apiRequest<HallEnquiryListData>(`/api/admin/hall-enquiries/${query ? `?${query}` : ""}`, {
    accessToken,
  });
}

export function updateHallEnquiryStatus(
  accessToken: string,
  id: string,
  body: { status: HallEnquiryStatus; rejection_reason?: string },
) {
  return apiRequest<HallEnquiry>(`/api/admin/hall-enquiries/${id}/`, {
    method: "PATCH",
    accessToken,
    body,
  });
}
