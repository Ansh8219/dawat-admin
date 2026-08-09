import type { Branch } from "./mock/data";
import { branches } from "./mock/data";

export type Panel = Branch;

export const PANELS = branches;

export type PanelStat = {
  label: string;
  value: string;
  hint: string;
  hintTone: "up" | "warn" | "info" | "neutral";
  icon: "sales" | "orders" | "tables" | "pending" | "events" | "bookings" | "revenue";
};

export type PanelMeta = {
  id: Panel;
  label: string;
  gst: string;
  tagline: string;
  description: string;
  accent: string;
  /** Soft tint for icon / badge surfaces */
  tint: string;
  /** Card theme: button + metric icon colors */
  theme: "primary" | "amber" | "violet";
  image: string;
  imageAlt: string;
  active?: boolean;
  alert: string;
  /** Short capability chips shown on the picker */
  features: readonly string[];
  /** Snapshot stats for the picker cards */
  stats: readonly PanelStat[];
  /** Hours / status line */
  hours: string;
  status: "Open" | "Events only";
  /** Sidebar route paths allowed for this panel */
  routes: readonly string[];
};

export const PANEL_ORDER: Panel[] = ["restaurant", "bakery", "banquet"];

export const PANEL_META: Record<Panel, PanelMeta> = {
  restaurant: {
    id: "restaurant",
    label: "Restaurant",
    gst: "07AABCU9603R1Z2",
    tagline: "Dine-in • Takeaway • Delivery",
    description: "Restaurant menu, table floor plan, POS billing & kitchen orders.",
    accent: "from-rose-500/25 via-primary/12 to-transparent",
    tint: "bg-primary/15 text-primary",
    theme: "primary",
    image: "/panels/restaurant.jpg",
    imageAlt: "Restaurant dining room",
    active: true,
    alert: "2 Pending Approvals",
    features: ["Table floor", "Kitchen KOT", "Online orders", "Bookings"],
    stats: [
      { label: "Today's Sales", value: "₹24,500", hint: "↑ 12.4%", hintTone: "up", icon: "sales" },
      { label: "Orders Today", value: "143", hint: "↑ 8.7%", hintTone: "up", icon: "orders" },
      {
        label: "Active Tables",
        value: "12/18",
        hint: "66% Occupied",
        hintTone: "warn",
        icon: "tables",
      },
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
  bakery: {
    id: "bakery",
    label: "Bakery",
    gst: "07AABCU9603R1Z1",
    tagline: "Cakes • Pastries • Breads",
    description: "Orders, POS, bakery menu, inventory & delivery for the bakery studio.",
    accent: "from-amber-500/25 via-orange-400/10 to-transparent",
    tint: "bg-amber-500/15 text-amber-700",
    theme: "amber",
    image: "/panels/bakery.jpg",
    imageAlt: "Bakery cakes and cupcakes",
    alert: "Low Stock Alert",
    features: ["POS billing", "Bakery menu", "Inventory", "Delivery"],
    stats: [
      { label: "Today's Sales", value: "₹8,400", hint: "↑ 6.1%", hintTone: "up", icon: "sales" },
      { label: "Orders Today", value: "58", hint: "↑ 5.3%", hintTone: "up", icon: "orders" },
      {
        label: "Cakes Pending",
        value: "9",
        hint: "Needs Attention",
        hintTone: "warn",
        icon: "pending",
      },
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
  banquet: {
    id: "banquet",
    label: "Banquet Hall",
    gst: "07AABCU9603R1Z3",
    tagline: "Events • Bookings • Packages",
    description: "Hall bookings, decoration packages, advances & event calendar.",
    accent: "from-violet-500/25 via-purple-300/15 to-transparent",
    tint: "bg-violet-500/15 text-violet-700",
    theme: "violet",
    image: "/panels/banquet.jpg",
    imageAlt: "Banquet hall event setup",
    alert: "1 Event Today",
    features: ["Hall calendar", "Packages", "Advances", "Contracts"],
    stats: [
      { label: "Today's Events", value: "2", hint: "Today", hintTone: "up", icon: "events" },
      {
        label: "Upcoming",
        value: "7",
        hint: "This Week",
        hintTone: "info",
        icon: "bookings",
      },
      {
        label: "Revenue",
        value: "₹75,000",
        hint: "↑ 15.2%",
        hintTone: "up",
        icon: "revenue",
      },
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
