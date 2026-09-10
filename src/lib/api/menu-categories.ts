import { apiFormRequest, apiRequest } from "./client";
import type {
  CreateMenuCategoryFields,
  DetailData,
  MenuCategory,
  MenuCategoryListData,
  MenuCategoryListParams,
  MenuCategoryOptionsData,
  UpdateMenuCategoryFields,
} from "./types";

function appendField(form: FormData, key: string, value: string | number | boolean | undefined) {
  if (value === undefined) return;
  form.append(key, String(value));
}

export function listMenuCategories(accessToken: string, params: MenuCategoryListParams) {
  const qs = new URLSearchParams({ business_public_id: params.business_public_id });
  if (params.is_active !== undefined) qs.set("is_active", String(params.is_active));
  return apiRequest<MenuCategoryListData>(`/api/admin/menu-categories/?${qs.toString()}`, {
    method: "GET",
    accessToken,
  });
}

export function listMenuCategoryOptions(accessToken: string, businessPublicId: string) {
  const qs = new URLSearchParams({ business_public_id: businessPublicId });
  return apiRequest<MenuCategoryOptionsData>(
    `/api/admin/menu-categories/options/?${qs.toString()}`,
    {
      method: "GET",
      accessToken,
    },
  );
}

export function createMenuCategory(
  accessToken: string,
  fields: CreateMenuCategoryFields,
  image: File,
) {
  const form = new FormData();
  appendField(form, "business_public_id", fields.business_public_id);
  appendField(form, "name", fields.name);
  appendField(form, "sort_order", fields.sort_order);
  appendField(form, "is_active", fields.is_active);
  form.append("image", image);
  return apiFormRequest<MenuCategory>("/api/admin/menu-categories/", {
    method: "POST",
    accessToken,
    body: form,
  });
}

export function updateMenuCategory(
  accessToken: string,
  publicId: string,
  fields: UpdateMenuCategoryFields,
  image?: File | null,
) {
  const form = new FormData();
  appendField(form, "name", fields.name);
  appendField(form, "sort_order", fields.sort_order);
  appendField(form, "is_active", fields.is_active);
  if (image) {
    form.append("image", image);
  }
  return apiFormRequest<MenuCategory>(`/api/admin/menu-categories/${publicId}/`, {
    method: "PATCH",
    accessToken,
    body: form,
  });
}

export function deleteMenuCategory(accessToken: string, publicId: string) {
  return apiRequest<DetailData>(`/api/admin/menu-categories/${publicId}/`, {
    method: "DELETE",
    accessToken,
  });
}
