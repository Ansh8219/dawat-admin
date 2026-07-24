import { create } from "zustand";

interface AppState {
  dark: boolean;
  toggleDark: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export const useApp = create<AppState>((set) => ({
  dark: false,
  toggleDark: () =>
    set((s) => {
      const next = !s.dark;
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next);
      }
      return { dark: next };
    }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));
