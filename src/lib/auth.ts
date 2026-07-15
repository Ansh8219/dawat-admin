import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEMO_ADMIN } from "./brand";

export interface AuthUser {
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: AuthUser | null;
  login: (email: string, password: string) => { ok: true } | { ok: false; error: string };
  logout: () => void;
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

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
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
        });
        return { ok: true };
      },
      logout: () => set({ user: null }),
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
