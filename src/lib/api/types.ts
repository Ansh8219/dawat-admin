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

/** GET /api/auth/me/ — staff shape is `{ user }`; other roles add extra flags. */
export interface MeData {
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

/** Admin menu category entity from /api/admin/menu-categories/. */
export interface MenuCategory {
  public_id: string;
  name: string;
  menu_type: string;
  image: string | null;
  sort_order: number;
  is_active: boolean;
  item_count: number;
}

export interface MenuCategoryOption {
  public_id: string;
  name: string;
  sort_order: number;
}

export interface MenuCategoryListParams {
  business_public_id: string;
  is_active?: boolean;
}

export interface MenuCategoryListData {
  count: number;
  results: MenuCategory[];
}

export interface MenuCategoryOptionsData {
  count: number;
  results: MenuCategoryOption[];
}

export interface CreateMenuCategoryFields {
  business_public_id: string;
  name: string;
  sort_order?: number;
  is_active?: boolean;
}

export type UpdateMenuCategoryFields = Partial<{
  name: string;
  sort_order: number;
  is_active: boolean;
}>;

/** Summary shape from GET /api/admin/menu-items/ (list). */
export interface MenuItemSummary {
  public_id: string;
  name: string;
  category: string;
  category_public_id?: string;
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
  category_public_id?: string;
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
  category_public_id: string;
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

/** Partial fields for PATCH /api/admin/menu-items/{public_id}/ (multipart payload JSON). */
export type UpdateMenuItemPayload = Partial<Omit<CreateMenuItemPayload, "business_public_id">> & {
  /** Image public_ids from detail.images[].public_id to remove on update. */
  remove_image_public_ids?: string[];
};

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
  full_name: string | null;
  country_code: string;
  phone_number: string;
  tier: CustomerTier | string;
  profile_picture_url: string | null;
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

/** Partner onboarding / delivery-partner review */
export type PartnerStatus = "pending" | "approved" | "rejected" | string;

export type PartnerRejectField =
  | "full_name"
  | "email"
  | "date_of_birth"
  | "gender"
  | "profile_picture"
  | "aadhaar_front"
  | "aadhaar_back"
  | "house_flat"
  | "street"
  | "city"
  | "state"
  | "pincode"
  | "licence_number"
  | "licence_front"
  | "licence_back"
  | "vehicle_type"
  | "vehicle_model"
  | "vehicle_number"
  | "color"
  | "insurance_expiry_date"
  | "rc_front"
  | "rc_back"
  | "insurance_image"
  | "account_holder_name"
  | "account_number"
  | "ifsc_code"
  | "upi_id";

export interface PartnerListItem {
  public_id: string;
  full_name: string | null;
  phone_number: string;
  country_code: string;
  email: string | null;
  partner_status: PartnerStatus;
  submitted_at: string | null;
  created_at: string;
}

export interface PartnerListParams {
  status?: PartnerStatus | "";
  page?: number;
  page_size?: number;
}

export interface PartnerListData {
  count: number;
  page: number;
  page_size: number;
  results: PartnerListItem[];
}

export interface PartnerUser {
  country_code: string;
  phone_number: string;
  email: string | null;
  role: string;
}

export interface PartnerProfile {
  full_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  profile_picture_url: string | null;
}

export interface PartnerDocuments {
  aadhaar_front_url: string | null;
  aadhaar_back_url: string | null;
  licence_front_url: string | null;
  licence_back_url: string | null;
  rc_front_url: string | null;
  rc_back_url: string | null;
  insurance_image_url: string | null;
}

export interface PartnerAddress {
  house_flat: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export interface PartnerLicence {
  licence_number: string | null;
}

export interface PartnerVehicle {
  vehicle_type: string | null;
  vehicle_model: string | null;
  vehicle_number: string | null;
  color: string | null;
  insurance_expiry_date: string | null;
}

export interface PartnerBank {
  account_holder_name: string | null;
  account_number: string | null;
  ifsc_code: string | null;
  upi_id: string | null;
}

export interface PartnerDetail {
  public_id: string;
  partner_status: PartnerStatus;
  rejection_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  user: PartnerUser | null;
  profile: PartnerProfile | null;
  documents: PartnerDocuments | null;
  address: PartnerAddress | null;
  licence: PartnerLicence | null;
  vehicle: PartnerVehicle | null;
  bank: PartnerBank | null;
  rejected_fields?: PartnerRejectField[] | string[];
  rejected_steps?: string[];
  /** Previous reject reason after partner resubmits (status back to pending). */
  last_rejection_reason?: string | null;
  last_rejected_fields?: PartnerRejectField[] | string[];
  last_rejected_steps?: string[];
}

export type PartnerReviewPayload =
  | { action: "approve" }
  | {
      action: "reject";
      reason: string;
      rejected_fields: PartnerRejectField[];
    };

export interface PartnerReviewResult {
  public_id: string;
  partner_status: PartnerStatus;
  rejection_reason?: string | null;
  rejected_fields?: PartnerRejectField[] | string[];
  rejected_steps?: string[];
  last_rejection_reason?: string | null;
  last_rejected_fields?: PartnerRejectField[] | string[];
  last_rejected_steps?: string[];
  reviewed_at?: string | null;
}

/** Home Services tiles on the customer app (admin CRUD). */
export interface HomeService {
  public_id: string;
  key: string;
  name: string;
  description: string | null;
  image: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface HomeServiceListParams {
  is_active?: boolean;
}

export interface HomeServiceListData {
  count: number;
  results: HomeService[];
}

export interface CreateHomeServiceFields {
  key: string;
  name: string;
  description?: string;
  sort_order?: number;
  is_active?: boolean;
}

export type UpdateHomeServiceFields = Partial<{
  key: string;
  name: string;
  /** Pass empty string to clear. */
  description: string;
  sort_order: number;
  is_active: boolean;
}>;

export type AdminOrderTab = "new" | "preparing" | "ready" | "past";
export type AdminOrderStatus = "new" | "preparing" | "ready" | "rejected" | "delivered";

export interface AdminOrderAddress {
  address_type: string | null;
  full_name: string | null;
  phone: string | null;
  house_flat: string | null;
  landmark: string | null;
  formatted_address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface AdminOrderAddon {
  name?: string | null;
  price?: number | null;
  quantity?: number | null;
}

export interface AdminOrderItem {
  public_id: string;
  menu_item_public_id: string | null;
  menu_type: string | null;
  name: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  variant_name: string | null;
  variant_price: number | null;
  addons: AdminOrderAddon[] | null;
}

export interface AdminOrder {
  public_id: string;
  status: AdminOrderStatus | string;
  payment_method: string | null;
  payment_status: string | null;
  subtotal: number;
  preparation_minutes: number | null;
  reject_reason: string | null;
  created_at: string;
  waiting_seconds: number | null;
  address: AdminOrderAddress | null;
  items: AdminOrderItem[] | null;
}

export interface AdminOrderListParams {
  tab: AdminOrderTab;
  page?: number;
  page_size?: number;
}

export interface AdminOrderListData {
  count: number;
  page: number;
  page_size: number;
  results: AdminOrder[];
}

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
