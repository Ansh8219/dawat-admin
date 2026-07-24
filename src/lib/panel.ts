import type { Branch } from "./mock/data";
import { branches } from "./mock/data";

export type Panel = Branch;

export const PANELS = branches;

export type PanelMeta = {
  id: Panel;
  label: string;
  gst: string;
  tagline: string;
  description: string;
  accent: string;
  /** Sidebar route paths allowed for this panel */
  routes: readonly string[];
};

export const PANEL_META: Record<Panel, PanelMeta> = {
  bakery: {
    id: "bakery",
    label: "Bakery",
    gst: "07AABCU9603R1Z1",
    tagline: "Cakes · Pastries · Breads",
    description: "Orders, POS, bakery menu, inventory & delivery for the bakery studio.",
    accent: "from-amber-500/20 via-orange-400/10 to-transparent",
    routes: [
      "/",
      "/orders",
      "/pos",
      "/menu",
      "/inventory",
      "/customers",
      "/marketing",
      "/drivers",
      "/staff",
      "/finance",
      "/reports",
      "/notifications",
      "/settings",
    ],
  },
  restaurant: {
    id: "restaurant",
    label: "Restaurant",
    gst: "07AABCU9603R1Z2",
    tagline: "Dine-in · Takeaway · Delivery",
    description: "Restaurant menu, table floor plan, POS billing & kitchen orders.",
    accent: "from-rose-500/20 via-primary/10 to-transparent",
    routes: [
      "/",
      "/orders",
      "/pos",
      "/menu",
      "/inventory",
      "/bookings",
      "/customers",
      "/marketing",
      "/drivers",
      "/staff",
      "/finance",
      "/reports",
      "/notifications",
      "/settings",
    ],
  },
  banquet: {
    id: "banquet",
    label: "Banquet Hall",
    gst: "07AABCU9603R1Z3",
    tagline: "Events · Packages · Contracts",
    description: "Hall bookings, decoration packages, advances & event calendar.",
    accent: "from-violet-500/20 via-gold/15 to-transparent",
    routes: [
      "/",
      "/bookings",
      "/customers",
      "/marketing",
      "/staff",
      "/finance",
      "/reports",
      "/notifications",
      "/settings",
    ],
  },
};

export function getPanelMeta(panel: Panel): PanelMeta {
  return PANEL_META[panel];
}

export function isRouteAllowed(panel: Panel, pathname: string): boolean {
  const routes = PANEL_META[panel].routes;
  if (pathname === "/" || pathname === "") return routes.includes("/");
  return routes.some((r) => r !== "/" && (pathname === r || pathname.startsWith(`${r}/`)));
}
