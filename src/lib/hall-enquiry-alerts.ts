import { create } from "zustand";

/** Bumped by the admin socket on `hall_enquiry.created`; the Hall Enquiries page refetches on change. */
interface HallEnquiryAlertsState {
  tick: number;
  bump: () => void;
  reset: () => void;
}

export const useHallEnquiryAlerts = create<HallEnquiryAlertsState>((set) => ({
  tick: 0,
  bump: () => set((s) => ({ tick: s.tick + 1 })),
  reset: () => set({ tick: 0 }),
}));
