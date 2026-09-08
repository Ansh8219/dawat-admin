import { apiFormRequest, apiRequest } from "./client";
import type {
  CreateHomeServiceFields,
  DetailData,
  HomeService,
  HomeServiceListData,
  HomeServiceListParams,
  UpdateHomeServiceFields,
} from "./types";

/** Slug rules from the admin API: ^[a-z][a-z0-9_]*$ */
export const HOME_SERVICE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

function appendField(form: FormData, key: string, value: string | number | boolean | undefined) {
  if (value === undefined) return;
  form.append(key, String(value));
}

export function listHomeServices(accessToken: string, params: HomeServiceListParams = {}) {
  const qs = new URLSearchParams();
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  const query = qs.toString();
  return apiRequest<HomeServiceListData>(
    `/api/admin/home-services/${query ? `?${query}` : ""}`,
    {
      method: "GET",
      accessToken,
    },
  );
}

export function createHomeService(
  accessToken: string,
  fields: CreateHomeServiceFields,
  image: File,
) {
  const form = new FormData();
  appendField(form, "key", fields.key);
  appendField(form, "name", fields.name);
  appendField(form, "description", fields.description);
  appendField(form, "sort_order", fields.sort_order);
  appendField(form, "is_active", fields.is_active);
  form.append("image", image);
  return apiFormRequest<HomeService>("/api/admin/home-services/", {
    method: "POST",
    accessToken,
    body: form,
  });
}

export function updateHomeService(
  accessToken: string,
  publicId: string,
  fields: UpdateHomeServiceFields,
  image?: File | null,
) {
  const form = new FormData();
  appendField(form, "key", fields.key);
  appendField(form, "name", fields.name);
  if (fields.description !== undefined) {
    form.append("description", fields.description);
  }
  appendField(form, "sort_order", fields.sort_order);
  appendField(form, "is_active", fields.is_active);
  if (image) {
    form.append("image", image);
  }
  return apiFormRequest<HomeService>(`/api/admin/home-services/${publicId}/`, {
    method: "PATCH",
    accessToken,
    body: form,
  });
}

export function deleteHomeService(accessToken: string, publicId: string) {
  return apiRequest<DetailData>(`/api/admin/home-services/${publicId}/`, {
    method: "DELETE",
    accessToken,
  });
}
