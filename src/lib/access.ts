import { useAuth } from "./auth";
import type { AdminAccess } from "./api/types";
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
  "/pos": mod("orders"),
  "/menu": mod("menu"),
  "/menu-categories": mod("menu"),
  "/inventory": mod("inventory"),
  "/bookings": mod((panel) => (panel === "banquet" ? "halls" : "tables")),
  "/halls": mod("halls"),
  "/hall-bookings": mod("halls"),
  "/table-qr": mod("tables"),
  "/customers": mod("customers"),
  "/customer-levels": mod("rewards"),
  "/rewards": mod("rewards"),
  "/marketing": mod("offers"),
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
