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
  /** True while the account still uses an emailed temporary password. */
  must_change_password?: boolean;
}

/** GET /api/admin/me/access/ */
export interface AdminAccess {
  role: AdminRole | string;
  is_super_admin: boolean;
  /** Applies to every business. */
  permissions: string[];
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
  /** When false, customers cannot place new orders for this business. */
  is_accepting_orders: boolean;
  /** Managers only: this manager's permissions for the business. */
  permissions?: string[];
  /** Average customer rating; null when there are no reviews yet. */
  rating: number | null;
  review_count: number;
  menu_items_count: number;
  available_items_count: number;
  legal_name: string | null;
  gst_number: string | null;
  state: string | null;
  state_code: string | null;
  invoice_prefix: string | null;
  /** Invoices are only issued for this business when true. */
  is_invoice_ready: boolean;
  missing_fields: string[];
}

/** POST /api/admin/businesses/{public_id}/profile/ */
export interface BusinessProfile {
  public_id: string;
  panel_unit: string;
  name: string;
  logo: string | null;
  email: string;
}

/** GET /api/admin/dashboard/?business_public_id= */
export interface DashboardBusiness {
  public_id: string;
  type: BusinessType | string;
  name: string;
  is_accepting_orders: boolean;
}

export interface DashboardCounts {
  new: number;
  preparing: number;
  ready: number;
  done_today: number;
}

export interface DashboardKpis {
  today_sales: number;
  /** null when yesterday comparison is unavailable */
  sales_change_pct: number | null;
  orders_today: number;
  avg_ticket: number;
  rating: number | null;
  rating_count: number;
}

export interface DashboardStockAlert {
  public_id: string;
  name: string;
  available: number;
  unit: string;
  reorder_level: number;
}

export interface DashboardTopSelling {
  public_id: string;
  name: string;
  category: string | null;
  sold_today: number;
}

/** Last 7 days of sales, oldest first. */
export interface DashboardSalesTrendPoint {
  date: string;
  sales: number;
  orders: number;
}

/** Today's sales by UTC hour (0..23). */
export interface DashboardHourlySalesPoint {
  hour: number;
  sales: number;
  orders: number;
}

export type DashboardPaymentKey = "online" | "cod" | string;
export type DashboardFulfillmentKey = "delivery" | "takeaway" | "dine_in" | string;

export interface DashboardSplitPoint {
  key: string;
  sales: number;
  orders: number;
  share_pct: number;
}

export interface DashboardCategorySales {
  name: string;
  sales: number;
  orders: number;
  share_pct: number;
}

export interface AdminDashboardData {
  business: DashboardBusiness;
  counts: DashboardCounts;
  kpis: DashboardKpis;
  /** At most 5, most critical first. */
  stock_alerts: DashboardStockAlert[];
  top_selling: DashboardTopSelling[];
  sales_trend: DashboardSalesTrendPoint[];
  hourly_sales: DashboardHourlySalesPoint[];
  payment_split: DashboardSplitPoint[];
  fulfillment_split: DashboardSplitPoint[];
  category_sales: DashboardCategorySales[];
}

export type MenuUnit = "plate" | "pcs" | "kg" | "box" | "cup" | "glass" | "portion";
export type MenuDietary = "veg" | "egg" | "non_veg";
export type MenuTax = "gst_5" | "gst_12" | "gst_18" | "exempt";

export interface MenuVariant {
  public_id?: string;
  name: string;
  price: number | string;
}

export interface MenuAddonOption {
  public_id?: string;
  name: string;
  price: number | string;
}

export interface MenuAddonGroup {
  public_id?: string;
  name: string;
  min?: number;
  max?: number;
  options: MenuAddonOption[];
}

/** Recipe line scope on create / detail. */
export type MenuRecipeScope = "base" | "variant" | "addon";

/** Create payload recipe line — match variants/addons by name on create. */
export interface CreateMenuRecipeLine {
  inventory_item_public_id: string;
  quantity_per_unit: number;
  scope: MenuRecipeScope;
  variant_name?: string;
  addon_group_name?: string;
  addon_option_name?: string;
  notes?: string;
}

/** Recipe line on menu item detail response. */
export interface MenuRecipeLine {
  public_id?: string;
  inventory_item_public_id: string;
  inventory_sku?: string | null;
  inventory_name?: string | null;
  inventory_unit?: string | null;
  quantity_per_unit: number;
  scope: MenuRecipeScope;
  variant_name?: string | null;
  variant_public_id?: string | null;
  addon_group_name?: string | null;
  addon_group_public_id?: string | null;
  addon_option_name?: string | null;
  addon_option_public_id?: string | null;
  notes?: string | null;
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
  /** Staff-only short code (uppercased by backend), e.g. "101". */
  item_code?: string | null;
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
  item_code?: string | null;
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
  recipe?: MenuRecipeLine[];
  images: MenuItemImage[];
  created_at: string;
  updated_at: string;
}

/** @deprecated Use MenuItemDetail for full items, MenuItemSummary for list. */
export type MenuItem = MenuItemDetail;

export interface CreateMenuItemPayload {
  business_public_id: string;
  name: string;
  /** Up to 16 letters/numbers/hyphens, starting with a letter or number. "" or null on PATCH clears it. */
  item_code?: string | null;
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
  /** Optional recipe lines — omit or [] = no recipe. On PATCH: omit = untouched, array = full replace, [] = clear. */
  recipe?: CreateMenuRecipeLine[];
}

/** Partial fields for PATCH /api/admin/menu-items/{public_id}/ (multipart payload JSON). */
export type UpdateMenuItemPayload = Partial<Omit<CreateMenuItemPayload, "business_public_id">> & {
  /** Image public_ids from detail.images[].public_id to remove on update. */
  remove_image_public_ids?: string[];
};

export type CustomerSort = "name_asc" | "name_desc" | "orders_desc" | "orders_asc";

export interface CustomerTierSummary {
  public_id: string;
  key: string;
  name: string;
  customers_count: number;
}

export interface CustomerSummary {
  total_customers: number;
  tiers: CustomerTierSummary[];
}

export interface Customer {
  public_id: string;
  full_name: string | null;
  country_code: string | null;
  phone_number: string | null;
  email: string | null;
  gender: string | null;
  date_of_birth: string | null;
  joined_at: string | null;
  last_login: string | null;
  /** Level key, e.g. "foodie". Null if the profile is incomplete. */
  tier: string | null;
  /** Level display name, e.g. "Foodie". Null if the profile is incomplete. */
  tier_name: string | null;
  profile_picture_url: string | null;
  /** Completed (delivered/past) orders only. 0 if none. */
  orders_count: number;
  /** Sum of completed order totals. 0.0 if none. */
  ltv: number;
  /** ltv / orders_count. 0.0 if no orders. */
  avg_order_value: number;
  /** YYYY-MM-DD of last completed order, or null. */
  last_order_date: string | null;
  is_active: boolean;
}

export interface CustomerListParams {
  search?: string;
  tier?: string;
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

/** Customer level (reward tier) — /api/admin/reward-tiers/ */
export interface RewardTier {
  public_id: string;
  key: string;
  name: string;
  description: string | null;
  min_lifetime_coins: number;
  is_base: boolean;
}

export interface RewardTierListData {
  count: number;
  results: RewardTier[];
}

export interface CreateRewardTierPayload {
  key: string;
  name: string;
  min_lifetime_coins: number;
  description?: string;
}

/** PATCH — send only changed fields; `description: null` clears it. */
export type UpdateRewardTierPayload = Partial<Omit<CreateRewardTierPayload, "description">> & {
  description?: string | null;
};

/** Coin earning settings — /api/admin/reward-settings/ */
export type EarnCalculation = "proportional" | "full_steps";

export interface RewardSettings {
  is_enabled: boolean;
  earn_step_amount: number;
  coins_per_step: number;
  earn_calculation: EarnCalculation;
  min_order_amount: number;
  coin_value: number | null;
}

/** PATCH — send only changed fields; `coin_value: null` clears it. */
export type UpdateRewardSettingsPayload = Partial<RewardSettings>;

/** Bonus rule — /api/admin/reward-rules/ */
export type RewardRuleTrigger = "review" | string;

export interface RewardRule {
  trigger: RewardRuleTrigger;
  title: string;
  description: string | null;
  coins: number;
  is_active: boolean;
}

export interface RewardRuleListData {
  count: number;
  results: RewardRule[];
}

/** PATCH — send only changed fields; `description: null` clears it. */
export type UpdateRewardRulePayload = Partial<Omit<RewardRule, "trigger">>;

/** Customer coins — /api/admin/customers/{public_id}/coins/ */
export type CoinDirection = "credit" | "debit";
export type CoinEntryType = "order_earn" | "review_earn" | "admin_credit" | "admin_debit" | string;

export interface CoinEntry {
  public_id: string;
  entry_type: CoinEntryType;
  direction: CoinDirection;
  coins: number;
  order_public_id: string | null;
  note: string | null;
  created_at: string;
}

export interface CustomerCoinsTier {
  key: string;
  name: string;
  min_lifetime_coins: number;
}

export interface CustomerCoinsNextTier extends CustomerCoinsTier {
  coins_needed: number;
}

export interface CustomerCoinsData {
  coin_balance: number;
  lifetime_coins: number;
  tier: CustomerCoinsTier | null;
  next_tier: CustomerCoinsNextTier | null;
  history: {
    count: number;
    page: number;
    page_size: number;
    results: CoinEntry[];
  };
}

export interface AdjustCoinsPayload {
  direction: CoinDirection;
  coins: number;
  note: string;
}

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

/** Driver wallet on GET /api/admin/partners/ list and detail. */
export interface PartnerWallet {
  /** Delivery earnings the company still owes this driver. */
  balance: number;
  /** Cash collected from customers, not yet handed to the restaurant. */
  cash_pending: number;
}

export interface PartnerListItem {
  public_id: string;
  full_name: string | null;
  phone_number: string;
  country_code: string;
  email: string | null;
  partner_status: PartnerStatus;
  /** Account sign-in state (super_admin can toggle). */
  is_active?: boolean;
  submitted_at: string | null;
  created_at: string;
  wallet: PartnerWallet;
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
  is_active?: boolean;
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
  wallet: PartnerWallet;
  rejected_fields?: PartnerRejectField[] | string[];
  rejected_steps?: string[];
  /** Previous reject reason after partner resubmits (status back to pending). */
  last_rejection_reason?: string | null;
  last_rejected_fields?: PartnerRejectField[] | string[];
  last_rejected_steps?: string[];
}

/** POST /api/admin/partners/{public_id}/cash-receipt/ — full cash_pending in one shot. */
export interface PartnerCashReceipt {
  balance: number;
  cash_pending: number;
  submitted_amount: number;
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

/** Store keeper onboarding / admin review */
export type StoreKeeperStatus = "draft" | "pending" | "approved" | "rejected" | string;

export type StoreKeeperAssignedStore = "restaurant" | "bakery" | string;

export type StoreKeeperRejectField =
  | "full_name"
  | "email"
  | "profile_picture"
  | "date_of_joining"
  | "emergency_contact"
  | "assigned_store"
  | "manager_name"
  | "manager_phone"
  | "aadhaar_front"
  | "aadhaar_back"
  | "address_proof";

export interface StoreKeeperListItem {
  public_id: string;
  store_keeper_code: string | null;
  full_name: string | null;
  phone_number: string;
  country_code: string;
  email: string | null;
  assigned_store: StoreKeeperAssignedStore | null;
  store_keeper_status: StoreKeeperStatus;
  is_active?: boolean;
  submitted_at: string | null;
  created_at: string;
}

export interface StoreKeeperListParams {
  status?: StoreKeeperStatus | "";
  page?: number;
  page_size?: number;
}

export interface StoreKeeperListData {
  count: number;
  page: number;
  page_size: number;
  results: StoreKeeperListItem[];
}

export interface StoreKeeperUser {
  country_code: string;
  phone_number: string;
  email: string | null;
  role: string;
}

export interface StoreKeeperProfile {
  full_name: string | null;
  date_of_joining: string | null;
  emergency_country_code: string | null;
  emergency_phone_number: string | null;
  assigned_store: StoreKeeperAssignedStore | null;
  manager_name: string | null;
  manager_country_code: string | null;
  manager_phone_number: string | null;
  profile_picture_url: string | null;
}

export interface StoreKeeperDocuments {
  aadhaar_front_url: string | null;
  aadhaar_back_url: string | null;
  address_proof_url: string | null;
}

export interface StoreKeeperDetail {
  public_id: string;
  is_active?: boolean;
  store_keeper_code: string | null;
  store_keeper_status: StoreKeeperStatus;
  rejection_reason: string | null;
  rejected_fields: StoreKeeperRejectField[] | string[];
  last_rejection_reason: string | null;
  last_rejected_fields: StoreKeeperRejectField[] | string[];
  submitted_at: string | null;
  reviewed_at: string | null;
  user: StoreKeeperUser | null;
  profile: StoreKeeperProfile | null;
  documents: StoreKeeperDocuments | null;
}

export type StoreKeeperReviewPayload =
  | { action: "approve" }
  | {
      action: "reject";
      reason: string;
      rejected_fields: StoreKeeperRejectField[];
    };

export interface StoreKeeperReviewResult {
  detail?: string;
  public_id: string;
  store_keeper_status: StoreKeeperStatus;
  rejection_reason?: string | null;
  rejected_fields?: StoreKeeperRejectField[] | string[];
  last_rejection_reason?: string | null;
  last_rejected_fields?: StoreKeeperRejectField[] | string[];
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
/**
 * Admin-facing status strings from serialize_order(for_customer=False).
 * DB `new` → `placed`; DB `ready`/`ready_for_pickup` → `ready_for_pickup`;
 * DB `past` → `delivered`. Raw keys may still appear on other payloads.
 */
export type AdminOrderStatus =
  | "placed"
  | "new"
  | "accepted"
  | "preparing"
  | "ready"
  | "ready_for_pickup"
  | "driver_assigned"
  | "driver_at_restaurant"
  | "picked_up"
  | "on_the_way"
  | "delivered"
  | "past"
  | "rejected"
  | "cancelled";

/** Driver on a ready-tab order after assignment. */
export interface AdminOrderDriver {
  public_id: string;
  driver_code?: string | null;
  full_name: string | null;
  phone: string | null;
  profile_picture_url: string | null;
}

export interface AdminOrderCustomer {
  public_id: string;
  full_name: string | null;
  country_code: string | null;
  phone_number: string | null;
  email: string | null;
}

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
  /** Item code snapshotted when the order was placed (admin only). */
  item_code?: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  variant_name: string | null;
  variant_price: number | null;
  addons: AdminOrderAddon[] | null;
}

/** Dining table on a QR order (dine-in or counter takeaway). */
export interface AdminOrderTable {
  public_id?: string | null;
  table_number: string | null;
  seats?: number | null;
}

export interface AdminOrderAppliedOffer {
  public_id: string | null;
  code: string | null;
  title: string | null;
}

export interface AdminOrderPickup {
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface AdminOrderBusiness {
  public_id?: string;
  type?: string;
  name?: string;
  [key: string]: unknown;
}

export interface AdminOrder {
  public_id: string;
  /**
   * Not returned by admin order serialize today (refunds/partners use ORD{id}).
   * Kept optional for display helpers that fall back to public_id.
   */
  order_code?: string | null;
  status: AdminOrderStatus | string;
  /** delivery | takeaway (app or QR) | dine_in (QR). */
  fulfillment_type: string | null;
  /** Set when the order was placed from a dining-table QR. */
  table: AdminOrderTable | null;
  customer: AdminOrderCustomer | null;
  delivery_status: string | null;
  driver: AdminOrderDriver | null;
  driver_accepted_at: string | null;
  payment_method: string | null;
  payment_status: string | null;
  subtotal: number;
  discount_amount: number;
  tip_amount: number;
  tip_source: string | null;
  applied_offer: AdminOrderAppliedOffer | null;
  distance_km: number | null;
  delivery_fee: number | null;
  total: number | null;
  preparation_minutes: number | null;
  item_count: number | null;
  reject_reason: string | null;
  /** Set when the customer cancelled before preparing. */
  cancelled_at: string | null;
  cancel_reason: string | null;
  /** ISO timestamp; admin payload also mirrors this as ordered_at. */
  created_at: string;
  ordered_at: string | null;
  delivered_at: string | null;
  waiting_seconds: number | null;
  address: AdminOrderAddress | null;
  pickup: AdminOrderPickup | null;
  businesses: AdminOrderBusiness[];
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

export type AdminRefundStatus = "pending" | "processed" | "failed";
export type AdminRefundDestination = "wallet" | "original_payment";
export type AdminRefundReason = "customer_cancelled" | "restaurant_rejected";

export interface AdminRefundOrder {
  public_id: string;
  order_code: string | null;
  fulfillment_type: string | null;
  payment_method: string | null;
  total: number | null;
  item_count: number | null;
  ordered_at: string | null;
  cancelled_at: string | null;
  rejected_at: string | null;
}

export interface AdminRefundCustomer {
  public_id: string;
  full_name: string | null;
  country_code: string | null;
  phone_number: string | null;
}

export interface AdminRefund {
  public_id: string;
  amount: number;
  destination: AdminRefundDestination | string;
  status: AdminRefundStatus | string;
  reason: AdminRefundReason | string;
  initiated_at: string | null;
  refunded_at: string | null;
  failed_at: string | null;
  razorpay_refund_id: string | null;
  order: AdminRefundOrder | null;
  customer: AdminRefundCustomer | null;
}

export interface AdminRefundListParams {
  status?: AdminRefundStatus;
  page?: number;
  page_size?: number;
}

export interface AdminRefundListData {
  count: number;
  page: number;
  page_size: number;
  results: AdminRefund[];
}

/** POST /api/admin/refunds/{public_id}/retry/ */
export type AdminRefundRetryData = Pick<
  AdminRefund,
  "public_id" | "amount" | "destination" | "status" | "reason" | "initiated_at" | "refunded_at"
>;

/** Global dining table for QR dine-in ordering (admin CRUD). */
export interface RestaurantTable {
  public_id: string;
  table_number: string;
  seats: number;
  is_active: boolean;
  /** Guest order URL encoded in the table QR (stable after create). */
  qr_url: string;
  created_at: string;
  updated_at: string;
}

export interface RestaurantTableListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
}

export interface RestaurantTableListData {
  count: number;
  page: number;
  page_size: number;
  results: RestaurantTable[];
}

export interface CreateRestaurantTableFields {
  table_number: string;
  seats: number;
  is_active?: boolean;
}

export type UpdateRestaurantTableFields = Partial<{
  table_number: string;
  seats: number;
  is_active: boolean;
}>;

/** GET/PATCH /api/admin/booking-settings/. The only booking setting. */
export interface BookingSettings {
  per_guest_rate: string;
}

export interface UpdateBookingSettingsPayload {
  per_guest_rate: string;
}

export type TableBookingStatus = "pending_payment" | "confirmed" | "expired";

export interface TableBookingTable {
  public_id: string;
  table_number: string;
  seats: number;
}

export interface TableBookingCustomer {
  public_id: string;
  full_name: string;
  country_code: string;
  phone_number: string;
}

/** Booking from GET /api/admin/table-bookings/. Amount is stored on the booking. */
export interface TableBooking {
  public_id: string;
  status: TableBookingStatus | string;
  booking_date: string;
  arrival_time: string;
  duration_hours: number;
  ends_at: string;
  guests: number;
  occasion: string | null;
  per_guest_rate: string;
  amount: string;
  table: TableBookingTable;
  customer: TableBookingCustomer;
  created_at: string;
}

export type TableBookingScope = "today" | "upcoming" | "past" | "all";

export interface TableBookingListParams {
  scope?: TableBookingScope;
  date?: string;
  status?: TableBookingStatus;
  page?: number;
  page_size?: number;
}

export interface TableBookingListData {
  count: number;
  page: number;
  page_size: number;
  results: TableBooking[];
}

/** Single-row entity from GET/PATCH /api/admin/delivery-settings/. */
export interface DeliverySettings {
  pickup_name: string | null;
  pickup_address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** Rupees per km; delivery fee is always distance × this rate. */
  per_km_rate: number;
}

/** Partial fields for PATCH /api/admin/delivery-settings/. Omit unchanged keys. */
export type UpdateDeliverySettingsPayload = Partial<DeliverySettings>;

/** Inventory unit enum from /api/admin/inventory/. */
export type InventoryUnit = "kg" | "gram" | "litre" | "pcs";

/** GET /api/admin/inventory/categories/ */
export interface InventoryCategory {
  public_id: string;
  slug: string;
  name: string;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
}

export interface InventoryCategoryListData {
  count: number;
  results: InventoryCategory[];
}

export interface InventoryCategoryListParams {
  is_active?: boolean;
}

/** POST /api/admin/inventory/items/ */
export interface CreateInventoryItemPayload {
  business_public_id: string;
  category_public_id: string;
  sku: string;
  name: string;
  unit: InventoryUnit;
  reorder_level?: number;
  is_active?: boolean;
}

/** List / create shape from /api/admin/inventory/items/. */
export interface InventoryItemDetail {
  public_id: string;
  business_public_id?: string;
  category_public_id: string;
  category_slug?: string | null;
  category_name?: string | null;
  category?: string | null;
  sku: string;
  name: string;
  unit: InventoryUnit;
  reorder_level: number;
  is_active: boolean;
  available?: number;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItemListParams {
  business_public_id: string;
  is_active?: boolean;
}

export interface InventoryItemListData {
  count: number;
  results: InventoryItemDetail[];
}

/** PATCH /api/admin/inventory/items/{item_public_id}/stock/ */
export interface UpdateInventoryStockPayload {
  quantity: number;
  cost_per_unit?: number;
  stock_date?: string;
  notes?: string;
}

/** —— Admin offers / coupons —— */
export type OfferDiscountType = "percentage" | "flat";
export type OfferChannel = "delivery" | "pickup" | "dine_in";

export interface Offer {
  public_id: string;
  code: string;
  title: string;
  description: string;
  terms: string | null;
  image: string | null;
  discount_type: OfferDiscountType;
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number;
  usage_limit: number | null;
  per_user_limit: number;
  valid_from: string;
  valid_until: string;
  channels: OfferChannel[];
  is_active: boolean;
  sort_order: number;
  redemption_count: number;
  remaining_redemptions: number | null;
  is_currently_valid: boolean;
  /** true = restricted to specific customers */
  is_private?: boolean;
  /** number of customers assigned (private coupons) */
  customer_count?: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface OfferListParams {
  page?: number;
  page_size?: number;
  is_active?: boolean;
  channel?: OfferChannel;
  search?: string;
}

export interface OfferListData {
  count: number;
  page: number;
  page_size: number;
  results: Offer[];
}

/** Form fields for POST /api/admin/offers/ (multipart). Image is a separate file. */
export interface CreateOfferPayload {
  code: string;
  title: string;
  description?: string;
  terms?: string | null;
  discount_type: OfferDiscountType;
  discount_value: number;
  max_discount?: number | null;
  min_order_amount?: number;
  usage_limit?: number | null;
  per_user_limit?: number;
  valid_from: string;
  valid_until: string;
  channels: OfferChannel[];
  is_active?: boolean;
  sort_order?: number;
  /** Omit for a public coupon. Create only; PATCH ignores it. */
  customer_public_ids?: string[];
}

/** PATCH /api/admin/offers/{public_id}/ — multipart; image file is passed separately. */
export type UpdateOfferPayload = Partial<CreateOfferPayload> & {
  /** When true (and no new image file), the existing offer image is removed. */
  remove_image?: boolean;
};

export interface ToggleOfferActivePayload {
  is_active: boolean;
}

export interface OfferRedemptionCustomer {
  public_id: string;
  full_name: string | null;
  phone_number: string | null;
  country_code: string | null;
}

export interface OfferRedemption {
  public_id: string;
  channel: OfferChannel | string;
  discount_amount: number;
  order_subtotal: number;
  order_public_id: string | null;
  redeemed_at: string;
  customer: OfferRedemptionCustomer;
}

export interface OfferRedemptionListParams {
  page?: number;
  page_size?: number;
}

export interface OfferRedemptionListData {
  count: number;
  page: number;
  page_size: number;
  offer: {
    public_id: string;
    code: string;
    title: string;
  };
  results: OfferRedemption[];
}

/** GET/PUT /api/admin/businesses/{public_id}/invoice-details/ */
export interface BusinessInvoiceDetails {
  public_id: string;
  type: BusinessType | string;
  name: string;
  legal_name: string | null;
  gst_number: string | null;
  address: string | null;
  state: string | null;
  state_code: string | null;
  fssai_number: string | null;
  invoice_prefix: string | null;
  /** Invoices are only issued for this business when true. */
  is_invoice_ready: boolean;
  missing_fields: string[];
}

/** PUT body: all fields required. */
export interface BusinessInvoiceDetailsPayload {
  legal_name: string;
  gst_number: string;
  address: string;
  state: string;
  state_code: string;
  fssai_number: string;
  invoice_prefix: string;
}

export interface InvoiceBusiness {
  public_id: string;
  type: BusinessType | string;
  name: string;
}

export interface InvoiceTotals {
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

/** Row from GET /api/admin/invoices/ */
export interface InvoiceListItem {
  public_id: string;
  invoice_number: string;
  invoice_date: string;
  status: string;
  business: InvoiceBusiness;
  order_public_id: string;
  buyer_name: string | null;
  fulfillment_type: string | null;
  payment_method: string | null;
  taxable_amount: number;
  total_tax: number;
  total_amount: number;
}

export interface InvoiceListParams {
  business_public_id?: string;
  /** YYYY-MM-DD, IST, inclusive */
  date_from?: string;
  /** YYYY-MM-DD, IST, inclusive */
  date_to?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export interface InvoiceListData {
  count: number;
  page: number;
  page_size: number;
  /** Totals for the whole filter, not just this page. */
  totals: InvoiceTotals;
  results: InvoiceListItem[];
}

export interface InvoiceSeller {
  name: string;
  legal_name: string;
  gstin: string;
  address: string;
  state: string;
  state_code: string;
  fssai_number: string;
}

export interface InvoiceBuyer {
  name: string | null;
  phone: string | null;
  /** Null for pickup / dine-in. */
  address: string | null;
}

export interface InvoiceOrderSummary {
  public_id: string;
  status: string;
  fulfillment_type: string | null;
  payment_method: string | null;
  ordered_at: string | null;
  /** Driver tip; not part of the invoice. */
  tip_amount: number | null;
}

export interface InvoiceLine {
  position: number;
  line_type: "item" | "delivery" | string;
  description: string;
  sac_code: string;
  quantity: number;
  unit_price: number;
  gross_amount: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_rate: number;
  sgst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
}

/** GET /api/admin/invoices/{public_id}/ */
export interface InvoiceDetail {
  public_id: string;
  invoice_number: string;
  invoice_date: string;
  financial_year: string;
  status: string;
  title: string;
  business: InvoiceBusiness;
  seller: InvoiceSeller;
  buyer: InvoiceBuyer;
  place_of_supply: string;
  place_of_supply_code: string;
  order: InvoiceOrderSummary;
  lines: InvoiceLine[];
  gross_amount: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  total_amount: number;
}

/** GET /api/admin/orders/{public_id}/invoices/ */
export interface OrderInvoicesData {
  order_public_id: string;
  results: InvoiceDetail[];
}

/** GET /api/admin/analytics/* (super_admin only) */
export type AnalyticsGroupBy = "day" | "week" | "month";
export type AnalyticsReport = "sales" | "products" | "inventory" | "financial";

export interface AnalyticsBusinessRef {
  public_id: string;
  type: string;
  name: string;
}

export interface AnalyticsSplitRow {
  key: string;
  sales: number;
  orders: number;
  share_pct: number;
}

export interface AnalyticsBusinessSplitRow {
  business_public_id: string | null;
  name: string;
  sales: number;
  orders: number;
  share_pct: number;
}

export interface AnalyticsSalesSummary {
  revenue: number;
  orders: number;
  avg_order_value: number;
  discounts: number;
  delivery_fees: number;
  tips: number;
  order_total: number;
}

export interface AnalyticsSalesData {
  from: string;
  to: string;
  business: AnalyticsBusinessRef | null;
  summary: AnalyticsSalesSummary;
  trend: Array<{ period: string; sales: number; orders: number }>;
  hourly: Array<{ hour: number; sales: number; orders: number }>;
  by_payment_method: AnalyticsSplitRow[];
  by_fulfillment: AnalyticsSplitRow[];
  by_business?: AnalyticsBusinessSplitRow[];
}

export interface AnalyticsTopItem {
  public_id: string;
  name: string;
  item_code: string | null;
  category: string | null;
  quantity: number;
  revenue: number;
  cogs: number | null;
  margin: number | null;
  margin_pct: number | null;
}

export interface AnalyticsCategorySale {
  name: string;
  sales: number;
  orders: number;
  share_pct: number;
}

export interface AnalyticsSlowItem {
  public_id: string;
  name: string;
  item_code: string | null;
  category: string | null;
}

export interface AnalyticsProductsData {
  from: string;
  to: string;
  business: AnalyticsBusinessRef | null;
  top_items: AnalyticsTopItem[];
  category_sales: AnalyticsCategorySale[];
  slow_items: AnalyticsSlowItem[];
}

export interface AnalyticsLowStockItem {
  public_id: string;
  sku: string | null;
  name: string;
  unit: string;
  available: number;
  reorder_level: number;
}

export interface AnalyticsMovementRow {
  entry_type: "in" | "out" | "adjust" | string;
  reason: string | null;
  entries: number;
  quantity: number;
  value: number;
}

export interface AnalyticsInventoryData {
  from: string;
  to: string;
  business: AnalyticsBusinessRef | null;
  stock: { value: number; items: number; low_stock_count: number };
  low_stock: AnalyticsLowStockItem[];
  movement: AnalyticsMovementRow[];
  purchases: {
    total: number;
    by_supplier: Array<{ supplier: string; total: number; bills: number }>;
  };
}

export interface AnalyticsFinancialData {
  from: string;
  to: string;
  business: AnalyticsBusinessRef | null;
  revenue: number;
  orders: number;
  refunds: { amount: number; count: number };
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  purchases: number;
  net_after_purchases: number;
  notes: { revenue: string; cogs: string };
}

export interface AnalyticsFilterParams {
  from?: string;
  to?: string;
  business_public_id?: string;
}

/** Admin inbox — GET/POST /api/admin/notifications/ */
export type AdminNotificationType = "stock" | "purchase" | "account" | "system" | "wallet" | string;

export interface AdminNotification {
  public_id: string;
  type: AdminNotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string | null;
  /** Free-form metadata for future deep-links; keys are not fixed yet. */
  data: Record<string, unknown> | null;
}

export interface AdminNotificationListParams {
  is_read?: boolean;
  page?: number;
  page_size?: number;
}

export interface AdminNotificationListData {
  count: number;
  unread_count: number;
  page: number;
  page_size: number;
  results: AdminNotification[];
}

export interface AdminNotificationUnreadCountData {
  unread_count: number;
}

/** POST /api/admin/notifications/{public_id}/read/ */
export interface AdminNotificationReadData extends AdminNotification {
  unread_count: number;
}

/** POST /api/admin/notifications/read-all/ */
export interface AdminNotificationReadAllData {
  marked_read: number;
  unread_count: number;
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
