import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ShoppingBag, Calculator, UtensilsCrossed, Boxes,
  CalendarDays, Users, Megaphone, Bike, UserCog, Wallet, BarChart3, Bell, Settings,
  ChevronsLeft, ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";
import { LOGO_SRC } from "@/lib/brand";
import { usePanel, usePanelMeta } from "@/lib/use-panel";
import { isRouteAllowed } from "@/lib/panel";

const nav = [
  { section: "Overview", items: [
    { to: "/",             label: "Dashboard",     icon: LayoutDashboard },
  ]},
  { section: "Operations", items: [
    { to: "/orders",       label: "Orders",        icon: ShoppingBag },
    { to: "/pos",          label: "POS / Billing", icon: Calculator },
    { to: "/menu",         label: "Menu & Products", icon: UtensilsCrossed },
    { to: "/inventory",    label: "Inventory",     icon: Boxes },
    { to: "/bookings",     label: "Tables & Bookings", icon: CalendarDays },
  ]},
  { section: "Growth", items: [
    { to: "/customers",    label: "Customers",     icon: Users },
    { to: "/marketing",    label: "Marketing",     icon: Megaphone },
    { to: "/drivers",      label: "Drivers",       icon: Bike },
  ]},
  { section: "Admin", items: [
    { to: "/staff",        label: "Staff & Roles", icon: UserCog },
    { to: "/finance",      label: "Finance",       icon: Wallet },
    { to: "/reports",      label: "Reports",       icon: BarChart3 },
    { to: "/notifications",label: "Notifications", icon: Bell },
    { to: "/settings",     label: "Settings",      icon: Settings },
  ]},
] as const;

const bookingLabels: Record<string, string> = {
  bakery: "Bookings",
  restaurant: "Tables & Bookings",
  banquet: "Banquet Bookings",
};

const menuLabels: Record<string, string> = {
  bakery: "Bakery Menu",
  restaurant: "Restaurant Menu",
  banquet: "Packages",
};

export function AppSidebar({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const collapsed = useApp((s) => s.sidebarCollapsed) && !mobile;
  const toggle = useApp((s) => s.toggleSidebar);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const panel = usePanel();
  const meta = usePanelMeta();

  const filteredNav = nav
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => isRouteAllowed(panel, item.to))
        .map((item) => {
          if (item.to === "/bookings") {
            return { ...item, label: bookingLabels[panel] ?? item.label };
          }
          if (item.to === "/menu") {
            return { ...item, label: menuLabels[panel] ?? item.label };
          }
          return item;
        }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className={cn(
      "flex h-full flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
      collapsed ? "w-[72px]" : "w-64",
    )}>
      <div className={cn("flex flex-col items-center border-b border-sidebar-border px-3 py-4", collapsed && "px-2")}>
        <img
          src={LOGO_SRC}
          alt="Daawat Baker's — A Designer Bakery Studio"
          className={cn(
            "shrink-0 object-contain",
            collapsed ? "h-11 w-11 object-top" : "h-16 w-full max-w-[200px]",
          )}
        />
        {!collapsed && (
          <div className="mt-2 w-full rounded-xl bg-primary/10 px-2.5 py-1.5 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active panel</div>
            <div className="text-sm font-bold text-primary">{meta.label}</div>
            <div className="truncate font-mono text-[9px] text-muted-foreground">GST · {meta.gst}</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {filteredNav.map((group) => (
          <div key={group.section}>
            {!collapsed && (
              <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.section}
              </div>
            )}
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        collapsed && "justify-center px-2",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!mobile && (
        <button
          onClick={toggle}
          className="m-3 flex items-center justify-center gap-2 rounded-xl border border-sidebar-border py-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      )}
    </aside>
  );
}
