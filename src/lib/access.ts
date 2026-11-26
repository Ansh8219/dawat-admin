import { useMemo } from "react";
import { useAuth } from "./auth";
import type { AdminAccess, ScopedBusinessType } from "./api/types";
import {
  allowedBusinessTypes,
  isBusinessTypeAllowed,
  isScopedBusinessType,
} from "./business-scope";
import type { Panel } from "./panel";

/**
 * Single source of truth for UI visibility. This is NOT security — the backend
 * enforces permissions; the UI only hides what is not relevant to the user.
 */

function isSuper(access: AdminAccess | null, role?: string): boolean {
  return access ? access.is_super_admin : role === "super_admin";
}

/** can("orders:view") — super admin always; otherwise key must be in the permission union. */
export function canWith(access: AdminAccess | null, role: string | undefined, key: string) {
  if (isSuper(access, role)) return true;
  return Boolean(access?.permissions.includes(key));
}

export function can(key: string): boolean {
  const { access, user } = useAuth.getState();
  return canWith(access, user?.role, key);
}

/** Reactive helpers; re-evaluate when access or the selected business changes. */
export function useAccess() {
  const access = useAuth((s) => s.access);
  const role = useAuth((s) => s.user?.role);
  const superAdmin = isSuper(access, role);
  return {
    isSuperAdmin: superAdmin,
    can: (key: string) => canWith(access, role, key),
    /** Create/edit/delete/approve buttons for a module (permissions apply to all businesses). */
    canManage: (module: string) => canWith(access, role, `${module}:manage`),
    canView: (module: string) => canWith(access, role, `${module}:view`),
  };
}

export interface BusinessScope {
  /** Restaurant / Bakery types the user may see (both for super admin). */
  types: ScopedBusinessType[];
  /** Set when the manager is limited to one business; null when they have both. */
  single: ScopedBusinessType | null;
  /** Whether a business of this type should be shown (banquet hall is never limited). */
  allows: (type: string | null | undefined) => boolean;
  /** Drops businesses the user cannot access. */
  filter: <T extends { type: string }>(list: T[]) => T[];
  /**
   * Whether the panel switcher has anything to switch to. A one-business manager only
   * keeps it when they can also open the Banquet Hall panel.
   */
  canSwitchPanel: boolean;
  /** Businesses offered on the panel picker (drops Banquet Hall when it can't be used). */
  panelChoices: <T extends { type: string }>(list: T[]) => T[];
}

export function businessScopeWith(access: AdminAccess | null, role?: string): BusinessScope {
  const types = allowedBusinessTypes(access, role);
  const single = types.length === 1 ? types[0] : null;
  const allows = (type: string | null | undefined) => isBusinessTypeAllowed(access, role, type);
  const hallsUsable = single === null || canWith(access, role, "halls:view");
  return {
    types,
    single,
    allows,
    filter: (list) => list.filter((b) => allows(b.type)),
    canSwitchPanel: hallsUsable,
    panelChoices: (list) =>
      list.filter((b) => allows(b.type) && (hallsUsable || isScopedBusinessType(b.type))),
  };
}

/** Reactive business scope (Restaurant / Bakery access) of the signed-in user. */
export function useBusinessScope(): BusinessScope {
  const access = useAuth((s) => s.access);
  const role = useAuth((s) => s.user?.role);
  return useMemo(() => businessScopeWith(access, role), [access, role]);
}

type RouteRule =
  | { kind: "open" }
  | { kind: "superAdmin" }
  | { kind: "module"; module: string | ((panel: Panel) => string) };

const open: RouteRule = { kind: "open" };
const superAdmin: RouteRule = { kind: "superAdmin" };
const mod = (module: string | ((panel: Panel) => string)): RouteRule => ({
  kind: "module",
  module,
});

/**
 * Route → requirement. Module routes show when `<module>:view` is held.
 * Routes missing here default to super-admin only, so new pages never leak to managers.
 */
const ROUTE_RULES: Record<string, RouteRule> = {
  "/": open,
  "/notifications": open,
  "/settings": open,
  "/orders": mod("orders"),
  "/pos": mod("pos"),
  "/menu": mod("menu"),
  "/menu-categories": mod("menu"),
  "/inventory": mod("inventory"),
  "/bookings": mod((panel) => (panel === "banquet" ? "halls" : "tables")),
  "/halls": mod("halls"),
  "/hall-bookings": mod("halls"),
  "/hall-enquiries": mod("halls"),
  "/table-qr": mod("tables"),
  "/customers": mod("customers"),
  "/customer-levels": mod("rewards"),
  "/rewards": mod("rewards"),
  "/marketing": mod("offers"),
  "/campaigns": superAdmin, // push promotions
  "/refunds": mod("refunds"),
  "/invoices": mod("invoices"),
  "/analytics": mod("analytics"),
  "/people": superAdmin, // managers, drivers (partners), store keepers
  "/businesses": superAdmin,
  "/home-services": superAdmin,
};

function ruleFor(pathname: string): RouteRule {
  if (pathname === "" || pathname === "/") return ROUTE_RULES["/"];
  const key = Object.keys(ROUTE_RULES)
    .filter((r) => r !== "/" && (pathname === r || pathname.startsWith(`${r}/`)))
    .sort((a, b) => b.length - a.length)[0];
  return key ? ROUTE_RULES[key] : superAdmin;
}

/** Whether the signed-in user may see this route (menu item and page). */
export function isRouteVisible(
  pathname: string,
  panel: Panel,
  ctx: { access: AdminAccess | null; role?: string },
): boolean {
  const rule = ruleFor(pathname);
  if (rule.kind === "open") return true;
  if (isSuper(ctx.access, ctx.role)) return true;
  if (rule.kind === "superAdmin") return false;
  const module = typeof rule.module === "function" ? rule.module(panel) : rule.module;
  return canWith(ctx.access, ctx.role, `${module}:view`);
}
