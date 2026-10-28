import { apiRequest } from "./client";
import type {
  AdjustCoinsPayload,
  Customer,
  CustomerCoinsData,
  CustomerListData,
  CustomerListParams,
  DetailData,
  UpdateCustomerPayload,
} from "./types";

export function listCustomers(accessToken: string, params: CustomerListParams = {}) {
  const qs = new URLSearchParams();
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.tier) qs.set("tier", params.tier);
  if (params.sort) qs.set("sort", params.sort);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiRequest<CustomerListData>(`/api/admin/customers/${query ? `?${query}` : ""}`, {
    method: "GET",
    accessToken,
  });
}

export function updateCustomer(
  accessToken: string,
  publicId: string,
  payload: UpdateCustomerPayload,
) {
  return apiRequest<Customer>(`/api/admin/customers/${publicId}/`, {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}

export function deleteCustomer(accessToken: string, publicId: string) {
  return apiRequest<DetailData>(`/api/admin/customers/${publicId}/`, {
    method: "DELETE",
    accessToken,
  });
}

export const COIN_ADJUST_MAX = 100000;
export const COIN_NOTE_MAX = 255;

export function getCustomerCoins(
  accessToken: string,
  publicId: string,
  params: { page?: number; page_size?: number } = {},
) {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiRequest<CustomerCoinsData>(
    `/api/admin/customers/${publicId}/coins/${query ? `?${query}` : ""}`,
    { method: "GET", accessToken },
  );
}

/** 201 — returns the same shape as GET (history page 1). */
export function adjustCustomerCoins(
  accessToken: string,
  publicId: string,
  payload: AdjustCoinsPayload,
) {
  return apiRequest<CustomerCoinsData>(`/api/admin/customers/${publicId}/coins/`, {
    method: "POST",
    accessToken,
    body: payload,
  });
}

const COIN_ENTRY_LABELS: Record<string, string> = {
  order_earn: "Order",
  review_earn: "Review bonus",
  admin_credit: "Added by admin",
  admin_debit: "Deducted by admin",
};

export function coinEntryLabel(entryType: string): string {
  const known = COIN_ENTRY_LABELS[entryType];
  if (known) return known;
  const text = entryType.replace(/_/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
}

export function formatCustomerPhone(c: Pick<Customer, "country_code" | "phone_number">): string {
  const code = c.country_code?.trim() || "";
  const phone = c.phone_number?.trim() || "";
  if (!code) return phone;
  if (!phone) return code;
  return `${code} ${phone}`;
}
