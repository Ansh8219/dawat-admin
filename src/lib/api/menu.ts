import { apiFormRequest, apiRequest } from "./client";
import type {
  CreateMenuItemPayload,
  InventoryUnit,
  MenuItemDetail,
  MenuItemSummary,
  MenuRecipeScope,
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
/** Up to 16 letters/numbers/hyphens, must start with a letter or number. */
export const ITEM_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{0,15}$/;

export function normalizeItemCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function menuItemToSummary(item: MenuItemDetail): MenuItemSummary {
  const firstImage = item.images[0];
  return {
    public_id: item.public_id,
    name: item.name,
    item_code: item.item_code ?? null,
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
    recipe_missing: item.recipe_missing ?? false,
  };
}

/**
 * Same rule as the backend: valid if there is at least one `base` line, or a `variant`
 * line for EVERY variant of the item.
 */
export function isRecipeValid(
  lines: { scope: MenuRecipeScope; variant_name?: string | null }[],
  variantNames: string[],
): boolean {
  if (lines.some((l) => l.scope === "base")) return true;
  const names = variantNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return false;
  const covered = new Set(
    lines.filter((l) => l.scope === "variant").map((l) => (l.variant_name ?? "").trim()),
  );
  return names.every((n) => covered.has(n));
}

const UNIT_FAMILIES: InventoryUnit[][] = [["kg", "gram"], ["litre", "ml"], ["pcs"]];

/** Recipe units allowed for an ingredient: same family as its stock unit. */
export function recipeUnitOptions(stockUnit: string | null | undefined): InventoryUnit[] {
  return UNIT_FAMILIES.find((f) => f.includes(stockUnit as InventoryUnit)) ?? [];
}

/** e.g. "30 gram (stock in kg)"; omits the suffix when units match. */
export function formatRecipeQuantity(line: {
  quantity_per_unit: number | string;
  unit?: string | null;
  inventory_unit?: string | null;
}): string {
  const unit = line.unit || line.inventory_unit || "";
  const base = `${line.quantity_per_unit} ${unit}`.trim();
  return line.inventory_unit && unit && unit !== line.inventory_unit
    ? `${base} (stock in ${line.inventory_unit})`
    : base;
}

export const RECIPE_REQUIRED_MESSAGE =
  "Add at least one Base ingredient, or an ingredient for every variant.";

/** Count of items missing a recipe (uses the `count` of the filtered query). */
export async function countRecipeMissingMenuItems(accessToken: string, businessPublicId: string) {
  const params = new URLSearchParams({
    business_public_id: businessPublicId,
    recipe_missing: "true",
    page: "1",
  });
  const data = await apiRequest<MenuItemSummary[] | MenuItemsPage>(
    `/api/admin/menu-items/?${params.toString()}`,
    { method: "GET", accessToken },
  );
  return Array.isArray(data) ? data.length : (data?.count ?? data?.results?.length ?? 0);
}

type MenuItemsPage = {
  count?: number;
  page?: number;
  page_size?: number;
  results?: MenuItemSummary[];
};

export async function listMenuItems(accessToken: string, businessPublicId: string) {
  const all: MenuItemSummary[] = [];
  const MAX_PAGES = 100;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const params = new URLSearchParams({
      business_public_id: businessPublicId,
      page: String(page),
    });
    const data = await apiRequest<MenuItemSummary[] | MenuItemsPage>(
      `/api/admin/menu-items/?${params.toString()}`,
      { method: "GET", accessToken },
    );
    if (Array.isArray(data)) return data;
    const results = data?.results ?? [];
    all.push(...results);
    const total = data?.count ?? all.length;
    if (results.length === 0 || all.length >= total) break;
  }
  return all;
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
