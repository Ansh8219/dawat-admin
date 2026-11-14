import { apiFormRequest, apiRequest } from "./client";
import type {
  Campaign,
  CampaignAudiencePreviewData,
  CampaignAudiencePreviewPayload,
  CampaignListData,
  CampaignListParams,
  CampaignPayload,
  CampaignRecipientListData,
  CampaignRecipientListParams,
} from "./types";

const BASE = "/api/admin/campaigns";

function qs(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** POST /api/admin/campaigns/audience-preview/ */
export function previewCampaignAudience(
  accessToken: string,
  payload: CampaignAudiencePreviewPayload,
  signal?: AbortSignal,
) {
  return apiRequest<CampaignAudiencePreviewData>(`${BASE}/audience-preview/`, {
    method: "POST",
    accessToken,
    body: payload,
    signal,
  });
}

/** Multipart body: repeated keys for `channels` and `whatsapp_template_params`. */
function buildCampaignForm(payload: CampaignPayload, image?: File | null) {
  const form = new FormData();
  form.append("name", payload.name);
  form.append("title", payload.title);
  form.append("body", payload.body);
  form.append("audience_type", payload.audience_type);
  if (payload.audience_days != null) form.append("audience_days", String(payload.audience_days));
  for (const ch of payload.channels) form.append("channels", ch);
  if (payload.offer_id) form.append("offer_id", payload.offer_id);
  if (payload.whatsapp_template_name) {
    form.append("whatsapp_template_name", payload.whatsapp_template_name);
  }
  if (payload.whatsapp_template_language) {
    form.append("whatsapp_template_language", payload.whatsapp_template_language);
  }
  for (const p of payload.whatsapp_template_params ?? []) {
    form.append("whatsapp_template_params", p);
  }
  if (payload.scheduled_at) form.append("scheduled_at", payload.scheduled_at);
  if (image) form.append("image", image);
  else if (payload.remove_image) form.append("remove_image", "true");
  return form;
}

/** POST /api/admin/campaigns/ → 201 (multipart). Starts immediately when `scheduled_at` is omitted/past. */
export function createCampaign(accessToken: string, payload: CampaignPayload, image?: File | null) {
  return apiFormRequest<Campaign>(`${BASE}/`, {
    method: "POST",
    accessToken,
    body: buildCampaignForm(payload, image),
  });
}

/** GET /api/admin/campaigns/?status=&page=&page_size= */
export function listCampaigns(accessToken: string, params: CampaignListParams = {}) {
  return apiRequest<CampaignListData>(
    `${BASE}/${qs({ status: params.status, page: params.page, page_size: params.page_size })}`,
    { method: "GET", accessToken },
  );
}

/** GET /api/admin/campaigns/{id}/ */
export function getCampaign(accessToken: string, id: string) {
  return apiRequest<Campaign>(`${BASE}/${id}/`, { method: "GET", accessToken });
}

/** PATCH /api/admin/campaigns/{id}/ — full multipart body; only while status = scheduled. */
export function updateCampaign(
  accessToken: string,
  id: string,
  payload: CampaignPayload,
  image?: File | null,
) {
  return apiFormRequest<Campaign>(`${BASE}/${id}/`, {
    method: "PATCH",
    accessToken,
    body: buildCampaignForm(payload, image),
  });
}

/** POST /api/admin/campaigns/{id}/cancel/ — only while status = scheduled. */
export function cancelCampaign(accessToken: string, id: string) {
  return apiRequest<Campaign>(`${BASE}/${id}/cancel/`, { method: "POST", accessToken });
}

/** GET /api/admin/campaigns/{id}/recipients/?status=&channel=&page=&page_size= */
export function listCampaignRecipients(
  accessToken: string,
  id: string,
  params: CampaignRecipientListParams = {},
) {
  return apiRequest<CampaignRecipientListData>(
    `${BASE}/${id}/recipients/${qs({
      status: params.status,
      channel: params.channel,
      page: params.page,
      page_size: params.page_size,
    })}`,
    { method: "GET", accessToken },
  );
}
