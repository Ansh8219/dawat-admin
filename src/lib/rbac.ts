/**
 * Module / action permissions for the admin panel (UI / mock-auth branch).
 */
export type Permission =
  | "dashboard.view"
  | "orders.manage"
  | "pos.billing"
  | "products.manage"
  | "inventory.manage"
  | "bookings.approve"
  | "customers.view"
  | "marketing.manage"
  | "deliveries.manage"
  | "staff.manage"
  | "finance.full"
  | "reports.view"
  | "notifications.view"
  | "settings.view"
  | "settings.manage"
  | "bills.edit_past"
  | "kitchen.toggle";

const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "orders.manage",
  "pos.billing",
  "products.manage",
  "inventory.manage",
  "bookings.approve",
  "customers.view",
  "marketing.manage",
  "deliveries.manage",
  "staff.manage",
  "finance.full",
  "reports.view",
  "notifications.view",
  "settings.view",
  "settings.manage",
  "bills.edit_past",
  "kitchen.toggle",
];

/** Manager = day-to-day ops (menu, stock, billing, orders, kitchen, deliveries, bookings). */
const MANAGER_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "orders.manage",
  "pos.billing",
  "products.manage",
  "inventory.manage",
  "bookings.approve",
  "customers.view",
  "deliveries.manage",
  "reports.view",
  "notifications.view",
  "settings.view",
  "kitchen.toggle",
];

const STORE_KEEPER_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "inventory.manage",
  "reports.view",
  "notifications.view",
  "settings.view",
];

const DRIVER_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "deliveries.manage",
  "notifications.view",
  "settings.view",
];

export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  super_admin: ALL_PERMISSIONS,
  admin: ALL_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  store_keeper: STORE_KEEPER_PERMISSIONS,
  driver: DRIVER_PERMISSIONS,
};

/** Map app routes → required permission (panel allowlist still applies separately). */
const ROUTE_PERMISSIONS: { path: string; permission: Permission }[] = [
  { path: "/", permission: "dashboard.view" },
  { path: "/orders", permission: "orders.manage" },
  { path: "/pos", permission: "pos.billing" },
  { path: "/menu", permission: "products.manage" },
  { path: "/inventory", permission: "inventory.manage" },
  { path: "/bookings", permission: "bookings.approve" },
  { path: "/customers", permission: "customers.view" },
  { path: "/marketing", permission: "marketing.manage" },
  { path: "/drivers", permission: "deliveries.manage" },
  { path: "/staff", permission: "staff.manage" },
  { path: "/finance", permission: "finance.full" },
  { path: "/reports", permission: "reports.view" },
  { path: "/notifications", permission: "notifications.view" },
  { path: "/settings", permission: "settings.view" },
];

export function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function permissionsFor(role: string | null | undefined): readonly Permission[] {
  const key = normalizeRole(role);
  return ROLE_PERMISSIONS[key] ?? [];
}

export function can(role: string | null | undefined, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}

export function permissionForRoute(pathname: string): Permission | null {
  if (pathname === "/" || pathname === "") return "dashboard.view";
  const match = ROUTE_PERMISSIONS.find(
    (r) => r.path !== "/" && (pathname === r.path || pathname.startsWith(`${r.path}/`)),
  );
  return match?.permission ?? null;
}

export function isRoutePermitted(role: string | null | undefined, pathname: string): boolean {
  const permission = permissionForRoute(pathname);
  if (!permission) return false;
  return can(role, permission);
}

/**
 * First route allowed by both role and panel allowlist.
 * Used when redirecting after a forbidden URL.
 */
export function fallbackRouteForRole(
  role: string | null | undefined,
  isPanelAllowed: (path: string) => boolean,
): string {
  const allowed = ROUTE_PERMISSIONS.find(
    (r) => can(role, r.permission) && isPanelAllowed(r.path),
  );
  return allowed?.path ?? "/";
}
