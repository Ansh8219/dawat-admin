import { apiRequest } from "./client";
import type {
  Customer,
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

export function formatCustomerPhone(c: Pick<Customer, "country_code" | "phone_number">): string {
  const code = c.country_code?.trim() || "";
  const phone = c.phone_number?.trim() || "";
  if (!code) return phone;
  if (!phone) return code;
  return `${code} ${phone}`;
}

export function tierLabel(tier: string): string {
  if (!tier) return "—";
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}
