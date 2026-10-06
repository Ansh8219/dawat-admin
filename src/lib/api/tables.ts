import { apiBinaryRequest, apiRequest } from "./client";
import type {
  CreateRestaurantTableFields,
  DetailData,
  RestaurantTable,
  RestaurantTableListData,
  RestaurantTableListParams,
  UpdateRestaurantTableFields,
} from "./types";

export function listTables(accessToken: string, params: RestaurantTableListParams = {}) {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const query = qs.toString();
  return apiRequest<RestaurantTableListData>(`/api/admin/tables/${query ? `?${query}` : ""}`, {
    method: "GET",
    accessToken,
  });
}

export function getTable(accessToken: string, publicId: string) {
  return apiRequest<RestaurantTable>(`/api/admin/tables/${publicId}/`, {
    method: "GET",
    accessToken,
  });
}

export function createTable(accessToken: string, fields: CreateRestaurantTableFields) {
  return apiRequest<RestaurantTable>("/api/admin/tables/", {
    method: "POST",
    accessToken,
    body: fields,
  });
}

export function updateTable(
  accessToken: string,
  publicId: string,
  fields: UpdateRestaurantTableFields,
) {
  return apiRequest<RestaurantTable>(`/api/admin/tables/${publicId}/`, {
    method: "PATCH",
    accessToken,
    body: fields,
  });
}

export function deleteTable(accessToken: string, publicId: string) {
  return apiRequest<DetailData>(`/api/admin/tables/${publicId}/`, {
    method: "DELETE",
    accessToken,
  });
}

/** Raw PNG bytes for print / download (not a JSON envelope). */
export function getTableQrPng(accessToken: string, publicId: string, signal?: AbortSignal) {
  return apiBinaryRequest(`/api/admin/tables/${publicId}/qr.png`, {
    method: "GET",
    accessToken,
    accept: "image/png",
    signal,
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
