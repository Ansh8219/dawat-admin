import { apiFormRequest, apiRequest } from "./client";
import type {
  CreateMenuItemPayload,
  MenuItemDetail,
  MenuItemSummary,
  MenuTax,
  UpdateMenuItemPayload,
} from "./types";

function scopedQuery(businessPublicId?: string): string {
  if (!businessPublicId) return "";
  const params = new URLSearchParams({ business_public_id: businessPublicId });
  return `?${params.toString()}`;
}

export const TAX_OPTIONS: { label: string; value: MenuTax }[] = [
  { label: "GST 5% (2.5% CGST + 2.5% SGST)", value: "gst_5" },
  { label: "GST 12% (6% CGST + 6% SGST)", value: "gst_12" },
  { label: "GST 18% (9% CGST + 9% SGST)", value: "gst_18" },
  { label: "Exempt", value: "exempt" },
];

export function taxLabel(tax: MenuTax): string {
  return TAX_OPTIONS.find((t) => t.value === tax)?.label ?? tax;
}

export function menuImageUrl(image: { url: string } | string): string {
  return typeof image === "string" ? image : image.url;
}

/** Map a detail/create response onto the list summary shape (fallback if list isn't re-fetched). */
export function menuItemToSummary(item: MenuItemDetail): MenuItemSummary {
  const firstImage = item.images[0];
  return {
    public_id: item.public_id,
    name: item.name,
    category: item.category,
    category_public_id: item.category_public_id,
    dietary: item.dietary,
    price: item.price,
    unit: item.unit,
    is_available: item.is_available,
    tags: item.tags ?? [],
    variant_count: item.variants?.length ?? 0,
    thumbnail: firstImage ? menuImageUrl(firstImage) : null,
    menu_type: item.menu_type,
    sort_order: item.sort_order,
  };
}

export function listMenuItems(accessToken: string, businessPublicId: string) {
  const params = new URLSearchParams({ business_public_id: businessPublicId });
  return apiRequest<MenuItemSummary[] | { results?: MenuItemSummary[] }>(
    `/api/admin/menu-items/?${params.toString()}`,
    {
      method: "GET",
      accessToken,
    },
  ).then((data) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.results)) return data.results;
    return [];
  });
}

export function getMenuItem(accessToken: string, publicId: string, businessPublicId?: string) {
  return apiRequest<MenuItemDetail>(
    `/api/admin/menu-items/${publicId}/${scopedQuery(businessPublicId)}`,
    {
      method: "GET",
      accessToken,
    },
  );
}

export function createMenuItem(
  accessToken: string,
  payload: CreateMenuItemPayload,
  images: File[],
) {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  for (const file of images) {
    form.append("images", file);
  }
  return apiFormRequest<MenuItemDetail>("/api/admin/menu-items/", {
    method: "POST",
    accessToken,
    body: form,
  });
}

export function updateMenuItem(
  accessToken: string,
  publicId: string,
  payload: UpdateMenuItemPayload,
  businessPublicId?: string,
  images: File[] = [],
) {
  const form = new FormData();
  form.append("payload", JSON.stringify(payload));
  for (const file of images) {
    form.append("images", file);
  }
  return apiFormRequest<MenuItemDetail>(
    `/api/admin/menu-items/${publicId}/${scopedQuery(businessPublicId)}`,
    {
      method: "PATCH",
      accessToken,
      body: form,
    },
  );
}

export function deleteMenuItem(accessToken: string, publicId: string, businessPublicId?: string) {
  return apiRequest<{ detail: string }>(
    `/api/admin/menu-items/${publicId}/${scopedQuery(businessPublicId)}`,
    {
      method: "DELETE",
      accessToken,
    },
  );
}
