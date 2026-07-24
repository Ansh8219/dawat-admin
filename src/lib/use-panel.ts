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
  return getPanelMeta(panel);
}

export function usePanelMenu() {
  const panel = usePanel();
  if (panel === "banquet") return [];
  return menuItems.filter((m) => m.branch === panel);
}

export function usePanelOrders(): Order[] {
  const panel = usePanel();
  if (panel === "banquet") return [];
  return orders.filter((o) => o.branch === panel);
}

export function usePanelInventory() {
  const panel = usePanel();
  if (panel === "banquet") return [];
  const label = panel === "bakery" ? "Bakery" : "Restaurant";
  return inventory.filter((i) => i.cat === label);
}

export function panelLabel(panel: Panel | Branch) {
  return getPanelMeta(panel as Panel).label;
}
