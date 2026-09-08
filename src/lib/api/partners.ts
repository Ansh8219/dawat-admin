import { apiRequest } from "./client";
import type {
  PartnerDetail,
  PartnerListData,
  PartnerListParams,
  PartnerRejectField,
  PartnerReviewPayload,
  PartnerReviewResult,
  PartnerStatus,
} from "./types";

export const PARTNER_REJECT_FIELDS: { value: PartnerRejectField; label: string; group: string }[] =
  [
    { value: "full_name", label: "Full name", group: "Profile" },
    { value: "email", label: "Email", group: "Profile" },
    { value: "date_of_birth", label: "Date of birth", group: "Profile" },
    { value: "gender", label: "Gender", group: "Profile" },
    { value: "profile_picture", label: "Profile picture", group: "Profile" },
    { value: "aadhaar_front", label: "Aadhaar front", group: "Documents" },
    { value: "aadhaar_back", label: "Aadhaar back", group: "Documents" },
    { value: "house_flat", label: "House / flat", group: "Address" },
    { value: "street", label: "Street", group: "Address" },
    { value: "city", label: "City", group: "Address" },
    { value: "state", label: "State", group: "Address" },
    { value: "pincode", label: "Pincode", group: "Address" },
    { value: "licence_number", label: "Licence number", group: "Licence" },
    { value: "licence_front", label: "Licence front", group: "Licence" },
    { value: "licence_back", label: "Licence back", group: "Licence" },
    { value: "vehicle_type", label: "Vehicle type", group: "Vehicle" },
    { value: "vehicle_model", label: "Vehicle model", group: "Vehicle" },
    { value: "vehicle_number", label: "Vehicle number", group: "Vehicle" },
    { value: "color", label: "Color", group: "Vehicle" },
    { value: "insurance_expiry_date", label: "Insurance expiry", group: "Vehicle" },
    { value: "rc_front", label: "RC front", group: "Vehicle" },
    { value: "rc_back", label: "RC back", group: "Vehicle" },
    { value: "insurance_image", label: "Insurance image", group: "Vehicle" },
    { value: "account_holder_name", label: "Account holder", group: "Bank" },
    { value: "account_number", label: "Account number", group: "Bank" },
    { value: "ifsc_code", label: "IFSC code", group: "Bank" },
    { value: "upi_id", label: "UPI ID", group: "Bank" },
  ];

export function listPartners(accessToken: string, params: PartnerListParams = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiRequest<PartnerListData>(`/api/admin/partners/${query ? `?${query}` : ""}`, {
    method: "GET",
    accessToken,
  });
}

export function getPartner(accessToken: string, publicId: string) {
  return apiRequest<PartnerDetail>(`/api/admin/partners/${publicId}/`, {
    method: "GET",
    accessToken,
  });
}

export function reviewPartner(
  accessToken: string,
  publicId: string,
  payload: PartnerReviewPayload,
) {
  return apiRequest<PartnerReviewResult>(`/api/admin/partners/${publicId}/review/`, {
    method: "POST",
    accessToken,
    body: payload,
  });
}

export function formatPartnerPhone(p: {
  country_code?: string | null;
  phone_number?: string | null;
}): string {
  const code = p.country_code?.trim() || "";
  const phone = p.phone_number?.trim() || "";
  if (!code) return phone || "—";
  if (!phone) return code;
  return `${code} ${phone}`;
}

export function partnerStatusLabel(status: PartnerStatus | undefined): string {
  if (!status) return "Unknown";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatPartnerDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const REJECT_FIELD_LABELS = Object.fromEntries(
  PARTNER_REJECT_FIELDS.map((f) => [f.value, f.label]),
) as Record<string, string>;

const REJECT_STEP_LABELS: Record<string, string> = {
  profile: "Profile",
  personal: "Personal",
  identity: "Identity",
  documents: "Documents",
  address: "Address",
  licence: "Licence",
  vehicle: "Vehicle",
  bank: "Bank",
};

export function partnerRejectFieldLabel(field: string): string {
  return REJECT_FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

export function partnerRejectStepLabel(step: string): string {
  return REJECT_STEP_LABELS[step] ?? step.charAt(0).toUpperCase() + step.slice(1);
}
