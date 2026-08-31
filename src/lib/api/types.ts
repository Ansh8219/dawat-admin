/** Shared API response envelope from the Dawat backend. */
export interface ApiErrorBody {
  code: string;
  details: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  status_code: number;
  message: string;
  data: T | null;
  error: ApiErrorBody | null;
}

export type AdminRole = "super_admin" | "manager" | "store_keeper" | "driver";

export interface AuthUser {
  public_id: string;
  email: string;
  role: AdminRole | string;
  is_staff: boolean;
}

export interface LoginData {
  access: string;
  refresh: string;
  user: AuthUser;
}

export interface DetailData {
  detail: string;
}

export interface RefreshData {
  access: string;
}

/** Business module type keys from GET /api/admin/businesses/ */
export type BusinessType = "restaurant" | "bakery" | "banquet_hall";

export interface Business {
  public_id: string;
  type: BusinessType | string;
  name: string;
  image: string | null;
}

export type MenuUnit = "plate" | "pcs" | "kg" | "box" | "cup" | "glass" | "portion";
export type MenuDietary = "veg" | "egg" | "non_veg";
export type MenuTax = "gst_5" | "gst_12" | "gst_18" | "exempt";

export interface MenuVariant {
  name: string;
  price: number | string;
}

export interface MenuAddonOption {
  name: string;
  price: number | string;
}

export interface MenuAddonGroup {
  name: string;
  min?: number;
  max?: number;
  options: MenuAddonOption[];
}

export interface MenuItemImage {
  url: string;
  public_id?: string;
  sort_order?: number;
}

/** Summary shape from GET /api/admin/menu-items/ (list). */
export interface MenuItemSummary {
  public_id: string;
  name: string;
  category: string;
  dietary: MenuDietary;
  price: number | string;
  unit: MenuUnit;
  is_available: boolean;
  tags: string[];
  variant_count: number;
  thumbnail: string | null;
  menu_type: string;
  sort_order?: number;
}

/** Full shape from GET detail / POST create. */
export interface MenuItemDetail {
  public_id: string;
  menu_type: string;
  business_public_id?: string;
  category: string;
  name: string;
  description: string | null;
  price: number | string;
  unit: MenuUnit;
  dietary: MenuDietary;
  serves: string | null;
  tax: MenuTax;
  packaging_charge: number | string;
  tags: string[];
  is_available: boolean;
  sort_order: number;
  variants: MenuVariant[];
  addon_groups: MenuAddonGroup[];
  images: MenuItemImage[];
  created_at: string;
  updated_at: string;
}

/** @deprecated Use MenuItemDetail for full items, MenuItemSummary for list. */
export type MenuItem = MenuItemDetail;

export interface CreateMenuItemPayload {
  business_public_id: string;
  name: string;
  category: string;
  price: number;
  unit: MenuUnit;
  dietary: MenuDietary;
  tax: MenuTax;
  description?: string;
  serves?: string;
  packaging_charge?: number;
  tags?: string[];
  is_available?: boolean;
  sort_order?: number;
  variants?: MenuVariant[];
  addon_groups?: MenuAddonGroup[];
}

/** Partial fields for PATCH /api/admin/menu-items/{public_id}/ */
export type UpdateMenuItemPayload = Partial<
  Omit<CreateMenuItemPayload, "business_public_id">
>;

export type CustomerTier = "silver" | "gold" | "platinum";
export type CustomerSort = "name_asc" | "name_desc" | "orders_desc" | "orders_asc";

export interface CustomerSummary {
  total_customers: number;
  silver_customers: number;
  gold_customers: number;
  platinum_customers: number;
}

export interface Customer {
  public_id: string;
  full_name: string;
  country_code: string;
  phone_number: string;
  tier: CustomerTier | string;
  orders_count: number | null;
  ltv: number | null;
  last_order_date: string | null;
  is_active: boolean;
}

export interface CustomerListParams {
  search?: string;
  tier?: CustomerTier | "";
  sort?: CustomerSort;
  page?: number;
  page_size?: number;
}

export interface CustomerListData {
  summary: CustomerSummary;
  count: number;
  page: number;
  page_size: number;
  results: Customer[];
}

export type UpdateCustomerPayload = {
  is_active?: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
