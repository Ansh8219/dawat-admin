import { apiRequest } from "./client";
import type { Business } from "./types";

/** GET /api/admin/businesses/ */
export function listBusinesses(accessToken: string) {
  return apiRequest<Business[]>("/api/admin/businesses/", {
    method: "GET",
    accessToken,
  });
}

/** PATCH /api/admin/businesses/{public_id}/accepting-orders/ */
export function setBusinessAcceptingOrders(
  accessToken: string,
  publicId: string,
  isAcceptingOrders: boolean,
) {
  return apiRequest<Business>(`/api/admin/businesses/${publicId}/accepting-orders/`, {
    method: "PATCH",
    accessToken,
    body: { is_accepting_orders: isAcceptingOrders },
  });
}
