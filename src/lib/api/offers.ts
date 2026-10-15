import { apiRequest } from "./client";
import type {
  CreateOfferPayload,
  Offer,
  OfferListData,
  OfferListParams,
  OfferRedemptionListData,
  OfferRedemptionListParams,
  ToggleOfferActivePayload,
  UpdateOfferPayload,
} from "./types";

/** GET /api/admin/offers/ */
export function listOffers(accessToken: string, params: OfferListParams = {}) {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  if (params.channel) qs.set("channel", params.channel);
  if (params.search?.trim()) qs.set("search", params.search.trim());
  const query = qs.toString();
  return apiRequest<OfferListData>(`/api/admin/offers/${query ? `?${query}` : ""}`, {
    method: "GET",
    accessToken,
  });
}

/** POST /api/admin/offers/ */
export function createOffer(accessToken: string, payload: CreateOfferPayload) {
  return apiRequest<Offer>("/api/admin/offers/", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

/** GET /api/admin/offers/{public_id}/ */
export function getOffer(accessToken: string, publicId: string) {
  return apiRequest<Offer>(`/api/admin/offers/${publicId}/`, {
    method: "GET",
    accessToken,
  });
}

/** PATCH /api/admin/offers/{public_id}/ */
export function updateOffer(accessToken: string, publicId: string, payload: UpdateOfferPayload) {
  return apiRequest<Offer>(`/api/admin/offers/${publicId}/`, {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}

/** PATCH /api/admin/offers/{public_id}/active/ */
export function toggleOfferActive(
  accessToken: string,
  publicId: string,
  payload: ToggleOfferActivePayload,
) {
  return apiRequest<Offer>(`/api/admin/offers/${publicId}/active/`, {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}

/** DELETE /api/admin/offers/{public_id}/ → 204 */
export function deleteOffer(accessToken: string, publicId: string) {
  return apiRequest<void>(`/api/admin/offers/${publicId}/`, {
    method: "DELETE",
    accessToken,
  });
}

/** GET /api/admin/offers/{public_id}/redemptions/ */
export function listOfferRedemptions(
  accessToken: string,
  publicId: string,
  params: OfferRedemptionListParams = {},
) {
  const qs = new URLSearchParams();
  if (params.page != null) qs.set("page", String(params.page));
  if (params.page_size != null) qs.set("page_size", String(params.page_size));
  const query = qs.toString();
  return apiRequest<OfferRedemptionListData>(
    `/api/admin/offers/${publicId}/redemptions/${query ? `?${query}` : ""}`,
    {
      method: "GET",
      accessToken,
    },
  );
}
