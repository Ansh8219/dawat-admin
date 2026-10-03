import { apiRequest } from "./client";
import type {
  StoreKeeperDetail,
  StoreKeeperDocuments,
  StoreKeeperListData,
  StoreKeeperListParams,
  StoreKeeperRejectField,
  StoreKeeperReviewPayload,
  StoreKeeperReviewResult,
  StoreKeeperStatus,
} from "./types";

export const STORE_KEEPER_REJECT_FIELDS: {
  value: StoreKeeperRejectField;
  label: string;
  group: string;
}[] = [
  { value: "full_name", label: "Full name", group: "Profile" },
  { value: "email", label: "Email", group: "Profile" },
  { value: "profile_picture", label: "Profile picture", group: "Profile" },
  { value: "date_of_joining", label: "Date of joining", group: "Profile" },
  { value: "emergency_contact", label: "Emergency contact", group: "Profile" },
  { value: "assigned_store", label: "Assigned store", group: "Assignment" },
  { value: "manager_name", label: "Manager name", group: "Assignment" },
  { value: "manager_phone", label: "Manager phone", group: "Assignment" },
  { value: "aadhaar_front", label: "Aadhaar front", group: "Documents" },
  { value: "aadhaar_back", label: "Aadhaar back", group: "Documents" },
  { value: "address_proof", label: "Address proof", group: "Documents" },
];

export function listStoreKeepers(accessToken: string, params: StoreKeeperListParams = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiRequest<StoreKeeperListData>(
    `/api/admin/store-keepers/${query ? `?${query}` : ""}`,
    {
      method: "GET",
      accessToken,
    },
  );
}

const EMPTY_DOCUMENTS: StoreKeeperDocuments = {
  aadhaar_front_url: null,
  aadhaar_back_url: null,
  address_proof_url: null,
};

export function normalizeStoreKeeper(sk: StoreKeeperDetail): StoreKeeperDetail {
  return {
    ...sk,
    rejected_fields: sk.rejected_fields ?? [],
    last_rejected_fields: sk.last_rejected_fields ?? [],
    user: sk.user ?? {
      country_code: "",
      phone_number: "",
      email: "",
      role: "",
    },
    profile: sk.profile ?? {
      full_name: "",
      date_of_joining: null,
      emergency_country_code: null,
      emergency_phone_number: null,
      assigned_store: null,
      manager_name: null,
      manager_country_code: null,
      manager_phone_number: null,
      profile_picture_url: null,
    },
    documents: sk.documents ?? EMPTY_DOCUMENTS,
  };
}

export function getStoreKeeper(accessToken: string, publicId: string) {
  return apiRequest<StoreKeeperDetail>(`/api/admin/store-keepers/${publicId}/`, {
    method: "GET",
    accessToken,
  }).then(normalizeStoreKeeper);
}

export function reviewStoreKeeper(
  accessToken: string,
  publicId: string,
  payload: StoreKeeperReviewPayload,
) {
  return apiRequest<StoreKeeperReviewResult>(`/api/admin/store-keepers/${publicId}/review/`, {
    method: "POST",
    accessToken,
    body: payload,
  });
}

export function formatStoreKeeperPhone(p: {
  country_code?: string | null;
  phone_number?: string | null;
}): string {
  const code = p.country_code?.trim() || "";
  const phone = p.phone_number?.trim() || "";
  if (!code) return phone || "—";
  if (!phone) return code;
  return `${code} ${phone}`;
}

export function storeKeeperStatusLabel(status: StoreKeeperStatus | undefined): string {
  if (!status) return "Unknown";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatStoreKeeperDate(value: string | null | undefined): string {
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

export function formatAssignedStore(store: string | null | undefined): string {
  if (!store?.trim()) return "—";
  return store.charAt(0).toUpperCase() + store.slice(1);
}

const REJECT_FIELD_LABELS = Object.fromEntries(
  STORE_KEEPER_REJECT_FIELDS.map((f) => [f.value, f.label]),
) as Record<string, string>;

export function storeKeeperRejectFieldLabel(field: string): string {
  return REJECT_FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}
