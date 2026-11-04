import { apiFormRequest, apiRequest } from "./client";
import type {
  CreateOfferPayload,
  Offer,
  OfferChannel,
  OfferListData,
  OfferListParams,
  OfferRedemptionListData,
  OfferRedemptionListParams,
  ToggleOfferActivePayload,
  UpdateOfferPayload,
} from "./types";

function appendField(form: FormData, key: string, value: string | number | boolean | undefined) {
  if (value === undefined) return;
  form.append(key, String(value));
}

function appendStringField(form: FormData, key: string, value: string | null | undefined) {
  if (value === undefined) return;
  form.append(key, value ?? "");
}

function appendNumberField(form: FormData, key: string, value: number | null | undefined) {
  if (value === undefined || value === null) return;
  form.append(key, String(value));
}

function appendChannels(form: FormData, channels: OfferChannel[] | undefined) {
  if (!channels) return;
  for (const channel of channels) {
    form.append("channels", channel);
  }
}

function buildOfferForm(
  fields: CreateOfferPayload | UpdateOfferPayload,
  image?: File | null,
  removeImage?: boolean,
) {
  const form = new FormData();
  appendField(form, "code", fields.code);
  appendField(form, "title", fields.title);
  appendStringField(form, "description", fields.description);
  appendStringField(form, "terms", fields.terms);
  appendField(form, "discount_type", fields.discount_type);
  appendField(form, "discount_value", fields.discount_value);
  appendNumberField(form, "max_discount", fields.max_discount);
  appendField(form, "min_order_amount", fields.min_order_amount);
  appendNumberField(form, "usage_limit", fields.usage_limit);
  appendField(form, "per_user_limit", fields.per_user_limit);
  appendField(form, "valid_from", fields.valid_from);
  appendField(form, "valid_until", fields.valid_until);
  appendChannels(form, fields.channels);
  appendField(form, "is_active", fields.is_active);
  appendField(form, "sort_order", fields.sort_order);
  if (image) {
    form.append("image", image);
  } else if (removeImage) {
    form.append("remove_image", "true");
  }
  return form;
}

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

/** POST /api/admin/offers/ — multipart/form-data */
export function createOffer(accessToken: string, payload: CreateOfferPayload, image?: File | null) {
  return apiFormRequest<Offer>("/api/admin/offers/", {
    method: "POST",
    accessToken,
    body: buildOfferForm(payload, image),
  });
}

/** GET /api/admin/offers/{public_id}/ */
export function getOffer(accessToken: string, publicId: string) {
  return apiRequest<Offer>(`/api/admin/offers/${publicId}/`, {
    method: "GET",
    accessToken,
  });
}

/** PATCH /api/admin/offers/{public_id}/ — multipart/form-data */
export function updateOffer(
  accessToken: string,
  publicId: string,
  payload: UpdateOfferPayload,
  image?: File | null,
) {
  const { remove_image, ...fields } = payload;
  return apiFormRequest<Offer>(`/api/admin/offers/${publicId}/`, {
    method: "PATCH",
    accessToken,
    body: buildOfferForm(fields, image, Boolean(remove_image) && !image),
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
