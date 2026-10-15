import { apiRequest } from "./client";
import type {
  CreateInventoryItemPayload,
  InventoryCategoryListData,
  InventoryCategoryListParams,
  InventoryItemDetail,
  InventoryItemListData,
  InventoryItemListParams,
  UpdateInventoryStockPayload,
} from "./types";

/** GET /api/admin/inventory/categories/ */
export function listInventoryCategories(
  accessToken: string,
  params: InventoryCategoryListParams = {},
) {
  const qs = new URLSearchParams();
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const query = qs.toString();
  return apiRequest<InventoryCategoryListData>(
    `/api/admin/inventory/categories/${query ? `?${query}` : ""}`,
    {
      method: "GET",
      accessToken,
    },
  );
}

/** GET /api/admin/inventory/items/?business_public_id=... */
export function listInventoryItems(accessToken: string, params: InventoryItemListParams) {
  const qs = new URLSearchParams({ business_public_id: params.business_public_id });
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  return apiRequest<InventoryItemListData>(`/api/admin/inventory/items/?${qs.toString()}`, {
    method: "GET",
    accessToken,
  });
}

/** POST /api/admin/inventory/items/ */
export function createInventoryItem(accessToken: string, payload: CreateInventoryItemPayload) {
  return apiRequest<InventoryItemDetail>("/api/admin/inventory/items/", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

/** PATCH /api/admin/inventory/items/{item_public_id}/stock/ */
export function updateInventoryItemStock(
  accessToken: string,
  itemPublicId: string,
  payload: UpdateInventoryStockPayload,
) {
  return apiRequest<InventoryItemDetail>(`/api/admin/inventory/items/${itemPublicId}/stock/`, {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}
