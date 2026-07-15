import { create } from "zustand";
import type { Branch } from "./mock/data";

interface AppState {
  branch: Branch | "all";
  setBranch: (b: Branch | "all") => void;
  dark: boolean;
  toggleDark: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useApp = create<AppState>((set) => ({
  branch: "all",
  setBranch: (branch) => set({ branch }),
  dark: false,
  toggleDark: () => set((s) => {
    const next = !s.dark;
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", next);
    }
    return { dark: next };
  }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
