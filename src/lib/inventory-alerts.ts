import { create } from "zustand";

/**
 * Cross-route inventory alert state. The admin socket lives in the layout; the Inventory page
 * refetches while mounted whenever `tick` changes.
 */
interface InventoryAlertsState {
  tick: number;
  lastItemId: string | null;
  bump: (itemPublicId: string) => void;
  reset: () => void;
}

export const useInventoryAlerts = create<InventoryAlertsState>((set) => ({
  tick: 0,
  lastItemId: null,
  bump: (itemPublicId) => set((s) => ({ tick: s.tick + 1, lastItemId: itemPublicId })),
  reset: () => set({ tick: 0, lastItemId: null }),
}));
