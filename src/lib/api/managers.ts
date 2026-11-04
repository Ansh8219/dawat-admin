import { apiRequest } from "./client";
import { ApiError } from "./types";

/**
 * Permission modules. Backend's list may change — edit only this constant.
 * Keys are sent as "<module>:view" / "<module>:manage".
 */
export const MANAGER_PERMISSION_MODULES = [
  { key: "orders", label: "Orders" },
  { key: "menu", label: "Menu" },
  { key: "tables", label: "Tables" },
  { key: "halls", label: "Halls" },
  { key: "offers", label: "Offers" },
  { key: "rewards", label: "Rewards" },
  { key: "customers", label: "Customers" },
  { key: "reviews", label: "Reviews" },
  { key: "inventory", label: "Inventory" },
  { key: "invoices", label: "Invoices" },
  { key: "analytics", label: "Analytics" },
  { key: "refunds", label: "Refunds" },
  { key: "partners", label: "Partners" },
  { key: "store_keepers", label: "Store keepers" },
] as const;

export type ManagerPermissionAction = "view" | "manage";

export const MANAGER_PERMISSION_ACTIONS: readonly ManagerPermissionAction[] = ["view", "manage"];

export function permissionKey(module: string, action: ManagerPermissionAction): string {
  return `${module}:${action}`;
}

export const ALL_MANAGER_PERMISSIONS: readonly string[] = MANAGER_PERMISSION_MODULES.flatMap((m) =>
  MANAGER_PERMISSION_ACTIONS.map((a) => permissionKey(m.key, a)),
);

export interface ManagerAssignment {
  business_id: string;
  permissions: string[];
}

export interface CreateManagerPayload {
  email: string;
  name: string;
  country_code: string;
  phone_number: string;
  assignments: ManagerAssignment[];
}

export interface CreatedManager {
  public_id: string;
  email: string;
  name: string;
  country_code: string;
  phone_number: string;
  assignments: ManagerAssignment[];
  invite_sent: boolean;
}

/** POST /api/admin/managers/ (super_admin only) */
export function createManager(accessToken: string, payload: CreateManagerPayload) {
  return apiRequest<CreatedManager>("/api/admin/managers/", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

export interface ManagerFormErrors {
  name?: string;
  email?: string;
  country_code?: string;
  phone_number?: string;
  businesses?: string;
  /** Keyed by business public_id. */
  assignments: Record<string, string>;
  /** Anything that could not be tied to a field. */
  general?: string;
}

/**
 * Maps a failed create call onto form fields. `sentBusinessIds` is the
 * assignments order that was submitted, used to resolve `assignments.N.*` paths.
 */
export function mapCreateManagerError(err: unknown, sentBusinessIds: string[]): ManagerFormErrors {
  const out: ManagerFormErrors = { assignments: {} };
  if (!(err instanceof ApiError)) {
    out.general = err instanceof Error && err.message ? err.message : "Something went wrong.";
    return out;
  }

  if (err.code === "email_taken") {
    out.email = "An account with this email already exists.";
    return out;
  }
  if (err.code === "business_not_found") {
    out.businesses = "One or more businesses were not found.";
    return out;
  }

  const isValidation =
    err.status === 400 || err.status === 422 || err.code === "validation_error";
  if (!isValidation) {
    out.general = err.message;
    return out;
  }

  const entries = extractFieldMessages(err.details);
  if (entries.length === 0) {
    out.general = err.message;
    return out;
  }

  const general: string[] = [];
  for (const { path, message } of entries) {
    const [head, idx] = path;
    if (head === "name" || head === "email" || head === "country_code" || head === "phone_number") {
      out[head] ??= message;
    } else if (head === "assignments") {
      const businessId = typeof idx === "number" ? sentBusinessIds[idx] : undefined;
      if (businessId) {
        out.assignments[businessId] ??= message;
      } else {
        out.businesses ??= message;
      }
    } else {
      general.push(message);
    }
  }
  if (general.length) out.general = general.join(" ");
  return out;
}

type FieldMessage = { path: (string | number)[]; message: string };

function extractFieldMessages(details: unknown): FieldMessage[] {
  const out: FieldMessage[] = [];

  // Pydantic / FastAPI style: [{ loc: ["body","assignments",0,"permissions",1], msg }]
  if (Array.isArray(details)) {
    for (const d of details) {
      if (typeof d === "string") {
        out.push({ path: [], message: d });
      } else if (d && typeof d === "object" && "msg" in d) {
        const loc = Array.isArray((d as { loc?: unknown }).loc)
          ? ((d as { loc: (string | number)[] }).loc ?? [])
          : [];
        const path = loc[0] === "body" ? loc.slice(1) : loc;
        out.push({ path, message: String((d as { msg: unknown }).msg) });
      }
    }
    return out;
  }

  // DRF style: { field: ["msg"], assignments: [{}, { permissions: ["msg"] }] }
  const walk = (value: unknown, path: (string | number)[]) => {
    if (value == null || value === "") return;
    if (typeof value === "string") {
      out.push({ path, message: value });
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => {
        if (typeof v === "string") out.push({ path, message: v });
        else walk(v, [...path, i]);
      });
    } else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) walk(v, [...path, k]);
    }
  };
  walk(details, []);
  return out;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ManagerFormValues {
  name: string;
  email: string;
  countryCode: string;
  phone: string;
  /** business public_id -> permission keys */
  assignments: Record<string, string[]>;
}

/** Client-side checks only; the backend is the final authority. */
export function validateManagerForm(v: ManagerFormValues): ManagerFormErrors {
  const e: ManagerFormErrors = { assignments: {} };
  if (!v.name.trim()) e.name = "Name is required.";
  if (!v.email.trim()) e.email = "Email is required.";
  else if (!EMAIL_RE.test(v.email.trim())) e.email = "Enter a valid email address.";
  if (!/^\+\d{1,4}$/.test(v.countryCode.trim())) e.country_code = "Use a format like +91.";
  const digits = v.phone.replace(/[\s-]/g, "");
  if (!digits) e.phone_number = "Phone number is required.";
  else if (!/^\d{6,15}$/.test(digits)) e.phone_number = "Enter a valid phone number.";
  if (Object.keys(v.assignments).length === 0) e.businesses = "Select at least one business.";
  return e;
}

export function hasManagerFormErrors(e: ManagerFormErrors): boolean {
  return Boolean(
    e.name ||
    e.email ||
    e.country_code ||
    e.phone_number ||
    e.businesses ||
    e.general ||
    Object.keys(e.assignments).length,
  );
}

export type ManagerInviteStatus = "pending" | "active";

export interface ManagerListAssignment {
  business_id: string;
  business_name: string;
  permissions: string[];
}

export interface ManagerListItem {
  public_id: string;
  email: string;
  name: string;
  country_code: string;
  phone_number: string;
  is_active: boolean;
  invite_status: ManagerInviteStatus | string;
  last_login: string | null;
  created_at: string;
  assignments: ManagerListAssignment[];
}

export interface ManagerListResponse {
  count: number;
  page: number;
  page_size: number;
  results: ManagerListItem[];
}

/** GET /api/admin/managers/?page=&page_size= (super_admin only, newest first) */
export function listManagers(
  accessToken: string,
  params: { page: number; page_size: number },
  signal?: AbortSignal,
) {
  const qs = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.page_size),
  });
  return apiRequest<ManagerListResponse>(`/api/admin/managers/?${qs.toString()}`, {
    method: "GET",
    accessToken,
    signal,
  });
}

/** Human-readable permissions: "Orders — View", "Menu — Manage" (manage implies view). */
export function describeManagerPermissions(permissions: string[]): string[] {
  const set = new Set(permissions);
  const known = new Set<string>();
  const out: string[] = [];
  for (const m of MANAGER_PERMISSION_MODULES) {
    const view = permissionKey(m.key, "view");
    const manage = permissionKey(m.key, "manage");
    known.add(view);
    known.add(manage);
    if (set.has(manage)) out.push(`${m.label} — Manage`);
    else if (set.has(view)) out.push(`${m.label} — View`);
  }
  for (const p of permissions) if (!known.has(p)) out.push(p);
  return out;
}

export function formatManagerPhone(m: Pick<ManagerListItem, "country_code" | "phone_number">) {
  return [m.country_code, m.phone_number].filter(Boolean).join(" ") || "—";
}
