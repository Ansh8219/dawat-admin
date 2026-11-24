import { apiRequest } from "./client";
import type {
  CounterOrder,
  CounterOrderItemsPayload,
  CounterOrderListData,
  CounterOrderSettled,
  CounterOrderStatusFilter,
  PosPaymentMethod,
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

const counterOrderPath = (publicId: string) =>
  `/api/admin/pos/counter-orders/${encodeURIComponent(publicId)}`;

/** GET /api/admin/pos/counter-orders/ — pay-at-counter orders (needs pos:view). */
export function listCounterOrders(
  accessToken: string,
  params: { status: CounterOrderStatusFilter; page?: number; page_size?: number },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({ status: params.status });
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  return apiRequest<CounterOrderListData>(`/api/admin/pos/counter-orders/?${qs}`, {
    method: "GET",
    accessToken,
    signal,
  });
}

/**
 * POST /api/admin/pos/counter-orders/{public_id}/settle/ (needs pos:manage).
 * Records the counter payment; creates the GST invoice(s). Never use createPosBill for these.
 */
export function settleCounterOrder(
  accessToken: string,
  publicId: string,
  paymentMethod: PosPaymentMethod,
) {
  return apiRequest<CounterOrderSettled>(`${counterOrderPath(publicId)}/settle/`, {
    method: "POST",
    body: { payment_method: paymentMethod },
    accessToken,
  });
}

/** GET /api/admin/pos/bills/{public_id}/ */
export function getPosBill(accessToken: string, publicId: string) {
  return apiRequest<PosBill>(`/api/admin/pos/bills/${publicId}/`, {
    method: "GET",
    accessToken,
  });
}

/** POST …/counter-orders/{id}/items/ — add extras (1–50 lines). Returns the updated order. */
export function addCounterOrderItems(
  accessToken: string,
  publicId: string,
  body: CounterOrderItemsPayload,
) {
  return apiRequest<CounterOrder>(`${counterOrderPath(publicId)}/items/`, {
    method: "POST",
    body,
    accessToken,
  });
}

/** PATCH …/counter-orders/{id}/items/{item_id}/ — change an extra's quantity (1–99). */
export function updateCounterOrderItem(
  accessToken: string,
  publicId: string,
  itemPublicId: string,
  quantity: number,
) {
  return apiRequest<CounterOrder>(
    `${counterOrderPath(publicId)}/items/${encodeURIComponent(itemPublicId)}/`,
    { method: "PATCH", body: { quantity }, accessToken },
  );
}

/** DELETE …/counter-orders/{id}/items/{item_id}/ — remove an extra. */
export function removeCounterOrderItem(
  accessToken: string,
  publicId: string,
  itemPublicId: string,
) {
  return apiRequest<CounterOrder>(
    `${counterOrderPath(publicId)}/items/${encodeURIComponent(itemPublicId)}/`,
    { method: "DELETE", accessToken },
  );
}
