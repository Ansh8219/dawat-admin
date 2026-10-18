import { create } from "zustand";

/**
 * Cross-route kitchen alert state (Zomato-style).
 * Socket lives in the admin layout; Orders page reacts to board ticks / highlights.
 */
interface KitchenAlertsState {
  /** Unseen new-order count for the Orders nav badge. */
  newOrderBadge: number;
  /** Bumped on WS events so the Orders board can soft-refresh while mounted. */
  boardTick: number;
  /** Latest created order id for row highlight on the board. */
  pendingHighlightId: string | null;
  bumpNewOrder: (orderPublicId: string) => void;
  clearNewOrderBadge: () => void;
  tickBoard: () => void;
  consumeHighlight: () => string | null;
  reset: () => void;
}

export const useKitchenAlerts = create<KitchenAlertsState>((set, get) => ({
  newOrderBadge: 0,
  boardTick: 0,
  pendingHighlightId: null,

  bumpNewOrder: (orderPublicId) =>
    set((s) => ({
      newOrderBadge: s.newOrderBadge + 1,
      pendingHighlightId: orderPublicId,
      boardTick: s.boardTick + 1,
    })),

  clearNewOrderBadge: () => set({ newOrderBadge: 0 }),

  tickBoard: () => set((s) => ({ boardTick: s.boardTick + 1 })),

  consumeHighlight: () => {
    const id = get().pendingHighlightId;
    if (id) set({ pendingHighlightId: null });
    return id;
  },

  reset: () => set({ newOrderBadge: 0, boardTick: 0, pendingHighlightId: null }),
}));
