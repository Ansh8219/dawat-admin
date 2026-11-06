import { apiRequest } from "./client";
import type {
  PosBill,
  PosBillListData,
  PosBillListParams,
  PosBillPayload,
  PosMenuData,
  PosMenuParams,
} from "./types";

/** GET /api/admin/pos/menu/ — one filtered page of the menu (needs orders:view). */
export function getPosMenu(accessToken: string, params: PosMenuParams, signal?: AbortSignal) {
  const qs = new URLSearchParams({ business_public_id: params.business_public_id });
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  if (params.q?.trim()) qs.set("q", params.q.trim().slice(0, 64));
  if (params.category_public_id) qs.set("category_public_id", params.category_public_id);
  if (params.code?.trim()) qs.set("code", params.code.trim().slice(0, 16));
  return apiRequest<PosMenuData>(`/api/admin/pos/menu/?${qs}`, {
    method: "GET",
    accessToken,
    signal,
  });
}

/** POST /api/admin/pos/bills/ — creates the bill (needs orders:manage). */
export function createPosBill(accessToken: string, body: PosBillPayload) {
  return apiRequest<PosBill>("/api/admin/pos/bills/", { method: "POST", body, accessToken });
}

/** GET /api/admin/pos/bills/ — bill history (needs orders:view). */
export function listPosBills(
  accessToken: string,
  params: PosBillListParams = {},
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams();
  if (params.business_public_id) qs.set("business_public_id", params.business_public_id);
  if (params.date_from) qs.set("date_from", params.date_from);
  if (params.date_to) qs.set("date_to", params.date_to);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  if (params.payment_method) qs.set("payment_method", params.payment_method);
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiRequest<PosBillListData>(`/api/admin/pos/bills/${query ? `?${query}` : ""}`, {
    method: "GET",
    accessToken,
    signal,
  });
}

/** GET /api/admin/pos/bills/{public_id}/ */
export function getPosBill(accessToken: string, publicId: string) {
  return apiRequest<PosBill>(`/api/admin/pos/bills/${publicId}/`, {
    method: "GET",
    accessToken,
  });
}
