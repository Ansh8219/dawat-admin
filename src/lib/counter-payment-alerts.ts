import { create } from "zustand";

/**
 * Cross-route state for pay-at-counter events. The admin socket lives in the layout; the POS
 * "Counter Payments" lists refetch while mounted whenever `tick` changes.
 */
interface CounterPaymentAlertsState {
  tick: number;
  /** Orders paid since the lists last loaded; hidden from Pending until the refetch lands. */
  paidIds: string[];
  /** Handed-over orders waiting at the counter (from order.payment_pending). */
  pendingAlerts: number;
  bumpPending: () => void;
  markPaid: (orderPublicId: string) => void;
  clearPendingAlerts: () => void;
  reset: () => void;
}

export const useCounterPaymentAlerts = create<CounterPaymentAlertsState>((set) => ({
  tick: 0,
  paidIds: [],
  pendingAlerts: 0,
  bumpPending: () => set((s) => ({ tick: s.tick + 1, pendingAlerts: s.pendingAlerts + 1 })),
  markPaid: (id) =>
    set((s) => ({
      tick: s.tick + 1,
      paidIds: [...s.paidIds.filter((x) => x !== id), id].slice(-50),
    })),
  clearPendingAlerts: () => set({ pendingAlerts: 0 }),
  reset: () => set({ tick: 0, paidIds: [], pendingAlerts: 0 }),
}));
