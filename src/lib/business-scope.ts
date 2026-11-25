import { ApiError, type AdminAccess, type ScopedBusinessType } from "./api/types";

/**
 * Which of Restaurant / Bakery the signed-in user may see. Pure helpers (no store imports)
 * so both the auth store and UI hooks can use them. Hiding is only for a clean UX: the
 * backend enforces business access and answers 403 `business_access_denied`.
 */

export const SCOPED_BUSINESS_TYPES: readonly ScopedBusinessType[] = ["restaurant", "bakery"];

export const BUSINESS_TYPE_LABELS: Record<ScopedBusinessType, string> = {
  restaurant: "Restaurant",
  bakery: "Bakery",
};

export function isScopedBusinessType(type: string | null | undefined): type is ScopedBusinessType {
  return type === "restaurant" || type === "bakery";
}

/** Normalised business types (restaurant first). Unknown values are dropped. */
export function normalizeBusinessTypes(types: readonly string[] | null | undefined) {
  const set = new Set(types ?? []);
  return SCOPED_BUSINESS_TYPES.filter((t) => set.has(t));
}

/**
 * Allowed business types. Super admins, sessions without access loaded, and older backends
 * that don't send `business_types` get both (same as before the field existed).
 */
export function allowedBusinessTypes(
  access: AdminAccess | null | undefined,
  role?: string,
): ScopedBusinessType[] {
  const superAdmin = access ? access.is_super_admin : role === "super_admin";
  if (superAdmin || !access?.business_types) return [...SCOPED_BUSINESS_TYPES];
  const types = normalizeBusinessTypes(access.business_types);
  return types.length ? types : [...SCOPED_BUSINESS_TYPES];
}

/** The one business a manager is limited to, or null when they have both. */
export function singleBusinessType(
  access: AdminAccess | null | undefined,
  role?: string,
): ScopedBusinessType | null {
  const types = allowedBusinessTypes(access, role);
  return types.length === 1 ? types[0] : null;
}

/** Restaurant/Bakery must be in the allowed list; other types (banquet hall) are not limited. */
export function isBusinessTypeAllowed(
  access: AdminAccess | null | undefined,
  role: string | undefined,
  type: string | null | undefined,
): boolean {
  if (!isScopedBusinessType(type)) return true;
  return allowedBusinessTypes(access, role).includes(type);
}

/** "Restaurant", "Bakery" or "Restaurant + Bakery". */
export function describeBusinessTypes(types: readonly string[] | null | undefined): string {
  const list = normalizeBusinessTypes(types);
  if (list.length === 0) return "—";
  return list.map((t) => BUSINESS_TYPE_LABELS[t]).join(" + ");
}

/** 403 for data that belongs only to a business the manager can't access. */
export function isBusinessAccessDenied(err: unknown): boolean {
  return err instanceof ApiError && err.code === "business_access_denied";
}
