import { apiRequest } from "./client";
import type { AdminDashboardData } from "./types";

/** GET /api/admin/dashboard/?business_public_id= */
export function getAdminDashboard(accessToken: string, businessPublicId: string) {
  const qs = new URLSearchParams({ business_public_id: businessPublicId });
  return apiRequest<AdminDashboardData>(`/api/admin/dashboard/?${qs.toString()}`, {
    method: "GET",
    accessToken,
  });
}
