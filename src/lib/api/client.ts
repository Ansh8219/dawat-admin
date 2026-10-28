import { ApiError, type ApiEnvelope } from "./types";

export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!fromEnv) {
    throw new Error("VITE_API_BASE_URL is not set. Add it to .env.");
  }
  return fromEnv.replace(/\/$/, "");
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string | null;
  signal?: AbortSignal;
};

type FormRequestOptions = {
  method?: "POST" | "PUT" | "PATCH";
  body: FormData;
  accessToken?: string | null;
  signal?: AbortSignal;
};

async function parseEnvelope<T>(response: Response): Promise<T> {
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      response.status,
      "invalid_response",
      `Unexpected response (${response.status}).`,
    );
  }

  if (envelope.success && envelope.data !== null) {
    return envelope.data;
  }

  const code = envelope.error?.code ?? "request_failed";
  const fromDetails = formatValidationDetails(envelope.error?.details);
  const apiMessage = envelope.message?.trim();
  const message =
    (code === "validation_error" && fromDetails) ||
    (apiMessage && apiMessage.toLowerCase() !== "success" ? apiMessage : "") ||
    humanizeErrorCode(code) ||
    fromDetails ||
    "Something went wrong. Please try again.";

  throw new ApiError(
    envelope.status_code || response.status,
    code,
    message,
    envelope.error?.details ?? null,
  );
}

function humanizeErrorCode(code: string): string {
  switch (code) {
    case "invalid_credentials":
      return "Invalid email or password.";
    case "staff_access_denied":
      return "This account does not have admin access.";
    case "account_inactive":
      return "This account has been deactivated.";
    case "validation_error":
      return "Please check your input and try again.";
    case "invalid_reset_token":
      return "This reset link is invalid or has expired.";
    case "invalid_old_password":
      return "Current password is incorrect.";
    case "not_authenticated":
      return "Please sign in again.";
    case "token_not_valid":
    case "token_expired":
      return "Your session has expired. Please sign in again.";
    case "business_not_found":
      return "Business not found. Please select a business again.";
    case "menu_type_unsupported":
      return "Menu management is not available for this business type.";
    case "menu_item_not_found":
      return "Menu item not found.";
    case "menu_category_not_found":
      return "Menu category not found.";
    case "menu_category_in_use":
      return "This category still has menu items. Move or delete those items first.";
    case "invalid_payload":
      return "Invalid request data. Please check your input and try again.";
    case "customer_not_found":
      return "Customer not found.";
    case "partner_not_found":
      return "Partner not found.";
    case "partner_not_pending":
      return "Only pending partners can be reviewed.";
    case "home_service_key_taken":
      return "That service key is already in use.";
    case "home_service_not_found":
      return "Home service not found.";
    case "not authenticated":
      return "Please sign in again.";
    case "order_not_found":
      return "Order not found.";
    case "invalid_order_status":
      return "That action is not allowed yet. Start preparing before marking ready.";
    case "invalid_pickup_location":
      return "Set both latitude and longitude, or leave both empty.";
    case "table_number_taken":
    case "dining_table_number_taken":
      return "That table number is already in use.";
    case "dining_table_not_found":
      return "Table not found.";
    case "dining_table_has_bookings":
      return "This table has bookings and cannot be deleted.";
    case "table_booking_not_found":
      return "Booking not found.";
    case "table_qr_base_url_not_configured":
      return "QR base URL is not configured on the server.";
    case "inventory_item_not_found":
      return "Inventory item not found.";
    case "inventory_category_not_found":
      return "Inventory category not found.";
    case "inventory_sku_taken":
      return "That SKU is already in use for this business.";
    case "inventory_stock_invalid":
      return "Invalid stock quantity. Please check and try again.";
    case "offer_code_taken":
      return "That coupon code is already in use.";
    case "offer_not_found":
      return "Offer not found.";
    case "offer_has_redemptions":
      return "This offer has redemptions and cannot be deleted. Deactivate it instead.";
    case "validation":
      return "Please check your input and try again.";
    case "reward_tier_key_taken":
      return "A level with this key already exists.";
    case "reward_tier_threshold_taken":
      return "Another level already starts at this many coins.";
    case "reward_tier_base_threshold_locked":
      return "The starting level must stay at 0 coins.";
    case "reward_tier_base_protected":
      return "The starting level cannot be deleted.";
    case "reward_tier_in_use":
      return "Customers are on this level, so it cannot be deleted.";
    case "reward_tier_not_found":
      return "Level not found.";
    case "reward_rule_not_found":
      return "Bonus rule not found.";
    case "insufficient_coins":
      return "Customer does not have enough coins for this deduction.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/** First message per field from a 400 `validation_error` (`error.details`). */
export function apiFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError) || err.code !== "validation_error") return {};
  const details = err.details;
  if (!details || typeof details !== "object" || Array.isArray(details)) return {};
  const out: Record<string, string> = {};
  for (const [field, value] of Object.entries(details as Record<string, unknown>)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first != null && first !== "") out[field] = String(first);
  }
  return out;
}

function formatValidationDetails(details: unknown): string | null {
  if (!details) return null;
  if (typeof details === "string") return details;
  if (Array.isArray(details)) {
    const parts = details.map((d) => (typeof d === "string" ? d : JSON.stringify(d)));
    return parts.filter(Boolean).join(" ");
  }
  if (typeof details === "object") {
    const entries = Object.entries(details as Record<string, unknown>);
    const messages = entries.flatMap(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map((v) => `${key}: ${String(v)}`);
      }
      if (typeof value === "string") return [`${key}: ${value}`];
      return [`${key}: ${JSON.stringify(value)}`];
    });
    if (messages.length) return messages.join(" ");
  }
  return null;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, accessToken, signal } = options;
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch {
    throw new ApiError(0, "network_error", "Unable to reach the server. Check your connection.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return parseEnvelope<T>(response);
}

export async function apiFormRequest<T>(path: string, options: FormRequestOptions): Promise<T> {
  const { method = "POST", body, accessToken, signal } = options;
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body,
      signal,
    });
  } catch {
    throw new ApiError(0, "network_error", "Unable to reach the server. Check your connection.");
  }

  return parseEnvelope<T>(response);
}

type BinaryRequestOptions = {
  method?: "GET";
  accessToken?: string | null;
  signal?: AbortSignal;
  /** Expected MIME type(s); used for Accept header. */
  accept?: string;
};

/**
 * Fetches a non-JSON response (e.g. image/png). On error responses that are JSON
 * envelopes, parses and throws ApiError like apiRequest.
 */
export async function apiBinaryRequest(
  path: string,
  options: BinaryRequestOptions = {},
): Promise<Blob> {
  const { method = "GET", accessToken, signal, accept = "*/*" } = options;
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Accept: accept,
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, { method, headers, signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "network_error", "Unable to reach the server. Check your connection.");
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    if (contentType.includes("application/json")) {
      return parseEnvelope<never>(response);
    }
    throw new ApiError(
      response.status,
      "request_failed",
      `Unexpected response (${response.status}).`,
    );
  }

  if (contentType.includes("application/json")) {
    return parseEnvelope<never>(response);
  }

  return response.blob();
}
