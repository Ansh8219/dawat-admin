import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_ACCOUNTS } from "./brand";
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

type PersistedAuthState = {
  user?: AuthUser | null;
  panel?: Panel | null;
};

function readPersistedAuthState(): PersistedAuthState | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem("daawat-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: PersistedAuthState };
    return parsed?.state ?? null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return Boolean(readPersistedAuthState()?.user);
}

export function getSelectedPanel(): Panel | null {
  const panel = readPersistedAuthState()?.panel;
  if (panel === "bakery" || panel === "restaurant" || panel === "banquet") return panel;
  return null;
}

export function getAuthUser(): AuthUser | null {
  return readPersistedAuthState()?.user ?? null;
}

export function getAuthRole(): string | null {
  return getAuthUser()?.role ?? null;
}

export function formatRoleLabel(role: string | undefined): string {
  if (!role) return "Admin";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isSuperAdmin(user: AuthUser | null | undefined): boolean {
  const role = (user?.role ?? "").toLowerCase().replace(/\s+/g, "_");
  return role === "super_admin" || role === "admin";
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
        const account = DEMO_ACCOUNTS.find(
          (a) => a.email === normalized && a.password === password,
        );
        if (!account) {
          return { ok: false, error: "Invalid email or password." };
        }
        set({
          user: {
            email: account.email,
            name: account.name,
            role: account.role,
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
