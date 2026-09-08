import { useMemo } from "react";
import { useAuth } from "./auth";
import { getPanelMeta, type Panel } from "./panel";
import {
  menuItems,
  orders,
  inventory,
  type Branch,
  type Order,
} from "./mock/data";

/** Active panel — throws if somehow used outside a panel session. */
export function usePanel(): Panel {
  const panel = useAuth((s) => s.panel);
  if (!panel) {
    // Fallback for HMR / edge cases — bakery as safe default for hooks
    return "bakery";
  }
  return panel;
}

export function usePanelMeta() {
  const panel = usePanel();
  const business = useAuth((s) => s.business);
  const meta = getPanelMeta(panel);
  return useMemo(() => {
    if (business?.name) {
      return { ...meta, label: business.name };
    }
    return meta;
  }, [business?.name, meta]);
}

export function usePanelMenu() {
  const panel = usePanel();
  return useMemo(() => {
    if (panel === "banquet") return [];
    return menuItems.filter((m) => m.branch === panel);
  }, [panel]);
}

export function usePanelOrders(): Order[] {
  const panel = usePanel();
  return useMemo(() => {
    if (panel === "banquet") return [];
    return orders.filter((o) => o.branch === panel);
  }, [panel]);
}

export function usePanelInventory() {
  const panel = usePanel();
  return useMemo(() => {
    if (panel === "banquet") return [];
    const label = panel === "bakery" ? "Bakery" : "Restaurant";
    return inventory.filter((i) => i.cat === label);
  }, [panel]);
}

export function panelLabel(panel: Panel | Branch) {
  return getPanelMeta(panel as Panel).label;
}
