import { apiRequest } from "./client";
import type {
  CreateInventoryItemPayload,
  InventoryHistoryData,
  InventoryHistoryEntry,
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

/** GET /api/admin/inventory/items/{item_public_id}/history/ */
export async function listInventoryItemHistory(
  accessToken: string,
  itemPublicId: string,
): Promise<InventoryHistoryEntry[]> {
  const data = await apiRequest<InventoryHistoryData | InventoryHistoryEntry[]>(
    `/api/admin/inventory/items/${itemPublicId}/history/`,
    { method: "GET", accessToken },
  );
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export type InventoryHistoryDisplay = {
  label: string;
  tone: "out" | "in" | "neutral";
  /** True when this reason is wastage (order usage / returns are NOT wastage). */
  isWastage: boolean;
};

/** Label + tone for a history row. `order` / `order_cancelled` are never wastage. */
export function describeInventoryHistory(entry: InventoryHistoryEntry): InventoryHistoryDisplay {
  switch (entry.reason) {
    case "order":
      return { label: "Used by order", tone: "out", isWastage: false };
    case "order_cancelled":
      return { label: "Returned (order cancelled)", tone: "in", isWastage: false };
    case "wastage":
      return { label: "Wastage", tone: "out", isWastage: true };
    default: {
      const label = entry.reason
        ? entry.reason.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
        : entry.entry_type === "out"
          ? "Stock out"
          : "Stock in";
      return { label, tone: entry.entry_type === "out" ? "out" : "in", isWastage: false };
    }
  }
}

/** Parses "(short by X)" from history notes (stock was not enough for the order). */
export function parseShortBy(notes: string | null | undefined): string | null {
  const m = notes?.match(/\(short by\s+([^)]+)\)/i);
  return m ? m[1].trim() : null;
}

/** Stable query key for an item's history. */
export const inventoryKeys = {
  history: (itemPublicId: string) => ["admin-inventory", "history", itemPublicId] as const,
};
