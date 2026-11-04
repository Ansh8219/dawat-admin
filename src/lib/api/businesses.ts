import { apiFormRequest, apiRequest } from "./client";
import type {
  Business,
  BusinessInvoiceDetails,
  BusinessInvoiceDetailsPayload,
  BusinessProfile,
} from "./types";

/** GET /api/admin/businesses/{public_id}/invoice-details/ */
export function getBusinessInvoiceDetails(accessToken: string, publicId: string) {
  return apiRequest<BusinessInvoiceDetails>(`/api/admin/businesses/${publicId}/invoice-details/`, {
    method: "GET",
    accessToken,
  });
}

/** PUT /api/admin/businesses/{public_id}/invoice-details/ (all fields required) */
export function updateBusinessInvoiceDetails(
  accessToken: string,
  publicId: string,
  payload: BusinessInvoiceDetailsPayload,
) {
  return apiRequest<BusinessInvoiceDetails>(`/api/admin/businesses/${publicId}/invoice-details/`, {
    method: "PUT",
    accessToken,
    body: payload,
  });
}

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

/** POST /api/admin/businesses/{public_id}/profile/ (multipart; send only changed fields) */
export function updateBusinessProfile(accessToken: string, publicId: string, body: FormData) {
  return apiFormRequest<BusinessProfile>(`/api/admin/businesses/${publicId}/profile/`, {
    method: "POST",
    accessToken,
    body,
  });
}
