import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_ADMIN } from "./brand";
import type { Panel } from "./panel";

export interface AuthUser {
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  panel: Panel | null;
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
  setPanel: (panel: Panel) => void;
  clearPanel: () => void;
  requestPasswordReset: (email: string) => { ok: true } | { ok: false; error: string };
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function isAuthenticated(): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = localStorage.getItem("daawat-auth");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { user?: AuthUser | null } };
    return Boolean(parsed?.state?.user);
  } catch {
    return false;
  }
}

export function getSelectedPanel(): Panel | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem("daawat-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { panel?: Panel | null } };
    const panel = parsed?.state?.panel;
    if (panel === "bakery" || panel === "restaurant" || panel === "banquet") return panel;
    return null;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      panel: null,
      login: (email, password) => {
        const normalized = email.trim().toLowerCase();
        if (!normalized || !password) {
          return { ok: false, error: "Email and password are required." };
        }
        if (normalized !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
          return { ok: false, error: "Invalid email or password." };
        }
        set({
          user: {
            email: DEMO_ADMIN.email,
            name: DEMO_ADMIN.name,
            role: DEMO_ADMIN.role,
          },
          // Force panel pick after every login
          panel: null,
        });
        return { ok: true };
      },
      logout: () => set({ user: null, panel: null }),
      setPanel: (panel) => set({ panel }),
      clearPanel: () => set({ panel: null }),
      requestPasswordReset: (email) => {
        const normalized = email.trim().toLowerCase();
        if (!normalized || !normalized.includes("@")) {
          return { ok: false, error: "Enter a valid email address." };
        }
        return { ok: true };
      },
    }),
    { name: "daawat-auth" },
  ),
);
