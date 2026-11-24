import { create } from "zustand";

/**
 * Cross-route state for pay-at-counter events. The admin socket lives in the layout; the POS
 * "Counter Payments" screens react while mounted.
 */
interface CounterPaymentAlertsState {
  /** Bumped when the Pending/Paid lists should refetch (new pending order, or one got paid). */
  tick: number;
  /** Orders already known to be pending (listed or toasted); repeat events for them are silent. */
  knownPending: string[];
  /** Orders paid since the lists last loaded; hidden from Pending until the refetch lands. */
  paidIds: string[];
  /** New pending orders the POS Counter tab has not shown yet (tab badge). */
  pendingAlerts: number;
  /** Last `order.payment_pending` for an order that was already known (extras changed). */
  changed: { id: string; total: string; seq: number } | null;
  /** Last `order.payment_received` from the socket. */
  received: { id: string; seq: number } | null;

  /** Socket: returns true when this is the first time the order is seen as pending. */
  paymentPending: (id: string, total: string) => boolean;
  paymentReceived: (id: string) => void;
  /** Pending list loaded: remember its orders so their later events don't toast. */
  rememberPending: (ids: string[]) => void;
  /** This till settled the order. */
  markPaid: (id: string) => void;
  clearPendingAlerts: () => void;
  reset: () => void;
}

const cap = (ids: string[]) => ids.slice(-200);

const initial = {
  tick: 0,
  knownPending: [] as string[],
  paidIds: [] as string[],
  pendingAlerts: 0,
  changed: null,
  received: null,
};

export const useCounterPaymentAlerts = create<CounterPaymentAlertsState>((set, get) => ({
  ...initial,
  paymentPending: (id, total) => {
    const isNew = !get().knownPending.includes(id);
    if (isNew) {
      set((s) => ({
        tick: s.tick + 1,
        pendingAlerts: s.pendingAlerts + 1,
        knownPending: cap([...s.knownPending, id]),
      }));
    } else {
      set((s) => ({ changed: { id, total, seq: (s.changed?.seq ?? 0) + 1 } }));
    }
    return isNew;
  },
  paymentReceived: (id) =>
    set((s) => ({
      tick: s.tick + 1,
      paidIds: cap([...s.paidIds.filter((x) => x !== id), id]),
      knownPending: s.knownPending.filter((x) => x !== id),
      received: { id, seq: (s.received?.seq ?? 0) + 1 },
    })),
  rememberPending: (ids) =>
    set((s) => {
      const missing = ids.filter((id) => !s.knownPending.includes(id));
      return missing.length ? { knownPending: cap([...s.knownPending, ...missing]) } : s;
    }),
  markPaid: (id) =>
    set((s) => ({
      tick: s.tick + 1,
      paidIds: cap([...s.paidIds.filter((x) => x !== id), id]),
      knownPending: s.knownPending.filter((x) => x !== id),
    })),
  clearPendingAlerts: () => set({ pendingAlerts: 0 }),
  reset: () => set(initial),
}));
