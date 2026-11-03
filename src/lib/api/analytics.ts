import { apiFileDownload, apiRequest } from "./client";
import { downloadBlob } from "./tables";
import type {
  AnalyticsFilterParams,
  AnalyticsFinancialData,
  AnalyticsGroupBy,
  AnalyticsInventoryData,
  AnalyticsProductsData,
  AnalyticsReport,
  AnalyticsSalesData,
} from "./types";

export const analyticsKeys = {
  all: ["admin-analytics"] as const,
  sales: (filters: AnalyticsFilterParams & { group_by: AnalyticsGroupBy }) =>
    [...analyticsKeys.all, "sales", filters] as const,
  products: (filters: AnalyticsFilterParams) =>
    [...analyticsKeys.all, "products", filters] as const,
  inventory: (filters: AnalyticsFilterParams) =>
    [...analyticsKeys.all, "inventory", filters] as const,
  financial: (filters: AnalyticsFilterParams) =>
    [...analyticsKeys.all, "financial", filters] as const,
};

function buildQuery(
  params: AnalyticsFilterParams & { group_by?: AnalyticsGroupBy; report?: AnalyticsReport },
): string {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.business_public_id) qs.set("business_public_id", params.business_public_id);
  if (params.group_by) qs.set("group_by", params.group_by);
  if (params.report) qs.set("report", params.report);
  const query = qs.toString();
  return query ? `?${query}` : "";
}

/** GET /api/admin/analytics/sales */
export function getAnalyticsSales(
  accessToken: string,
  params: AnalyticsFilterParams & { group_by?: AnalyticsGroupBy } = {},
  signal?: AbortSignal,
) {
  return apiRequest<AnalyticsSalesData>(`/api/admin/analytics/sales${buildQuery(params)}`, {
    method: "GET",
    accessToken,
    signal,
  });
}

/** GET /api/admin/analytics/products */
export function getAnalyticsProducts(
  accessToken: string,
  params: AnalyticsFilterParams = {},
  signal?: AbortSignal,
) {
  return apiRequest<AnalyticsProductsData>(`/api/admin/analytics/products${buildQuery(params)}`, {
    method: "GET",
    accessToken,
    signal,
  });
}

/** GET /api/admin/analytics/inventory */
export function getAnalyticsInventory(
  accessToken: string,
  params: AnalyticsFilterParams = {},
  signal?: AbortSignal,
) {
  return apiRequest<AnalyticsInventoryData>(`/api/admin/analytics/inventory${buildQuery(params)}`, {
    method: "GET",
    accessToken,
    signal,
  });
}

/** GET /api/admin/analytics/financial */
export function getAnalyticsFinancial(
  accessToken: string,
  params: AnalyticsFilterParams = {},
  signal?: AbortSignal,
) {
  return apiRequest<AnalyticsFinancialData>(`/api/admin/analytics/financial${buildQuery(params)}`, {
    method: "GET",
    accessToken,
    signal,
  });
}

/**
 * GET /api/admin/analytics/export — CSV attachment (not JSON envelope).
 * Uses Bearer auth; filename comes from Content-Disposition.
 */
export async function downloadAnalyticsCsv(
  accessToken: string,
  params: AnalyticsFilterParams & { report: AnalyticsReport },
  signal?: AbortSignal,
) {
  const { blob, filename } = await apiFileDownload(
    `/api/admin/analytics/export${buildQuery(params)}`,
    { method: "GET", accessToken, accept: "text/csv", signal },
  );
  const fallback = `${params.report}_${params.from ?? "from"}_${params.to ?? "to"}.csv`;
  downloadBlob(blob, filename || fallback);
}

/** Fill sparse hourly rows to a full 0–23 series (zeros for missing hours). */
export function fillHourlySales(
  rows: Array<{ hour: number; sales: number; orders: number }>,
): Array<{ hour: number; sales: number; orders: number; label: string }> {
  const byHour = new Map(rows.map((r) => [r.hour, r]));
  return Array.from({ length: 24 }, (_, hour) => {
    const row = byHour.get(hour);
    return {
      hour,
      sales: row?.sales ?? 0,
      orders: row?.orders ?? 0,
      label: String(hour).padStart(2, "0"),
    };
  });
}

export function formatSharePct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${value}%`;
}

export function isWastageReason(reason: string | null | undefined): boolean {
  const key = reason?.trim().toLowerCase() ?? "";
  return key === "wastage" || key === "damaged" || key === "expired";
}
