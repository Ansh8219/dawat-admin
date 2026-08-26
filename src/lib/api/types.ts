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
