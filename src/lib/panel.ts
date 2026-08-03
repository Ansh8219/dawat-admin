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
  /** Soft tint for icon / badge surfaces */
  tint: string;
  /** Short capability chips shown on the picker */
  features: readonly string[];
  /** Snapshot stats for the picker cards */
  stats: readonly { label: string; value: string }[];
  /** Hours / status line */
  hours: string;
  status: "Open" | "Events only";
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
    accent: "from-amber-500/25 via-orange-400/10 to-transparent",
    tint: "bg-amber-500/15 text-amber-700",
    features: ["POS billing", "Bakery menu", "Inventory", "Delivery"],
    stats: [
      { label: "Today", value: "₹48.2k" },
      { label: "Orders", value: "36" },
      { label: "SKUs", value: "64" },
    ],
    hours: "7:00 AM – 10:00 PM",
    status: "Open",
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
    accent: "from-rose-500/25 via-primary/12 to-transparent",
    tint: "bg-primary/15 text-primary",
    features: ["Table floor", "Kitchen KOT", "Online orders", "Bookings"],
    stats: [
      { label: "Today", value: "₹72.6k" },
      { label: "Covers", value: "118" },
      { label: "Tables", value: "24" },
    ],
    hours: "11:00 AM – 11:30 PM",
    status: "Open",
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
    accent: "from-gold/30 via-amber-200/20 to-transparent",
    tint: "bg-gold/20 text-gold-foreground",
    features: ["Hall calendar", "Packages", "Advances", "Contracts"],
    stats: [
      { label: "This week", value: "5 events" },
      { label: "Capacity", value: "350" },
      { label: "Advance", value: "₹2.1L" },
    ],
    hours: "By booking · 10:00 AM – 12:00 AM",
    status: "Events only",
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
