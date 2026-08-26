import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  adminLogin,
  changePassword as changePasswordApi,
  forgotPassword,
  refreshAccessToken,
  resetPassword as resetPasswordApi,
} from "./api/auth";
import { ApiError } from "./api/types";
import type { AuthUser as ApiAuthUser, Business } from "./api/types";
import { businessTypeToPanel, type Panel } from "./panel";

export interface AuthUser {
  publicId: string;
  email: string;
  role: string;
  isStaff: boolean;
  /** Display label derived from email local-part when API has no name. */
  name: string;
}

export interface SelectedBusiness {
  publicId: string;
  type: string;
  name: string;
  image: string | null;
  /** Local panel slug used for routing / mock data filters. */
  panel: Panel;
}

interface AuthTokens {
  access: string;
  refresh: string;
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  panel: Panel | null;
  business: SelectedBusiness | null;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => void;
  selectBusiness: (business: Business) => { ok: true } | { ok: false; error: string };
  /** @deprecated Prefer selectBusiness — kept for callers that only know the panel slug. */
  setPanel: (panel: Panel) => void;
  clearPanel: () => void;
  requestPasswordReset: (
    email: string,
  ) => Promise<{ ok: true; detail: string } | { ok: false; error: string }>;
  resetPassword: (
    token: string,
    password: string,
    passwordConfirm: string,
  ) => Promise<{ ok: true; detail: string } | { ok: false; error: string }>;
  changePassword: (
    oldPassword: string,
    password: string,
    passwordConfirm: string,
  ) => Promise<{ ok: true; detail: string } | { ok: false; error: string }>;
  refreshSession: () => Promise<boolean>;
  getAccessToken: () => string | null;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapUser(user: ApiAuthUser): AuthUser {
  return {
    publicId: user.public_id,
    email: user.email,
    role: user.role,
    isStaff: user.is_staff,
    name: displayNameFromEmail(user.email),
  };
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function clearSession() {
  return { user: null, tokens: null, panel: null, business: null } as const;
}

export function isAuthenticated(): boolean {
  if (!isBrowser()) return false;
  try {
    const raw = localStorage.getItem("daawat-auth");
    if (!raw) return false;
    const parsed = JSON.parse(raw) as {
      state?: { user?: AuthUser | null; tokens?: AuthTokens | null };
    };
    return Boolean(parsed?.state?.user && parsed?.state?.tokens?.access);
  } catch {
    return false;
  }
}

export function getSelectedPanel(): Panel | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem("daawat-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: { panel?: Panel | null; business?: SelectedBusiness | null };
    };
    const fromBusiness = parsed?.state?.business?.panel;
    if (fromBusiness === "bakery" || fromBusiness === "restaurant" || fromBusiness === "banquet") {
      return fromBusiness;
    }
    const panel = parsed?.state?.panel;
    if (panel === "bakery" || panel === "restaurant" || panel === "banquet") return panel;
    return null;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      panel: null,
      business: null,

      login: async (email, password) => {
        const normalized = email.trim().toLowerCase();
        if (!normalized || !password) {
          return { ok: false, error: "Email and password are required." };
        }
        try {
          const data = await adminLogin(normalized, password);
          set({
            user: mapUser(data.user),
            tokens: { access: data.access, refresh: data.refresh },
            panel: null,
            business: null,
          });
          return { ok: true };
        } catch (err) {
          return { ok: false, error: toErrorMessage(err, "Unable to sign in.") };
        }
      },

      logout: () => set(clearSession()),

      selectBusiness: (biz) => {
        const panel = businessTypeToPanel(biz.type);
        if (!panel) {
          return { ok: false, error: `Unsupported business type: ${biz.type}` };
        }
        set({
          panel,
          business: {
            publicId: biz.public_id,
            type: biz.type,
            name: biz.name,
            image: biz.image,
            panel,
          },
        });
        return { ok: true };
      },

      setPanel: (panel) =>
        set({
          panel,
          business: {
            publicId: "",
            type: panel === "banquet" ? "banquet_hall" : panel,
            name: panel,
            image: null,
            panel,
          },
        }),

      clearPanel: () => set({ panel: null, business: null }),

      requestPasswordReset: async (email) => {
        const normalized = email.trim().toLowerCase();
        if (!normalized || !normalized.includes("@")) {
          return { ok: false, error: "Enter a valid email address." };
        }
        try {
          const data = await forgotPassword(normalized);
          return { ok: true, detail: data.detail };
        } catch (err) {
          return {
            ok: false,
            error: toErrorMessage(err, "Unable to send reset link."),
          };
        }
      },

      resetPassword: async (token, password, passwordConfirm) => {
        if (!token.trim()) {
          return { ok: false, error: "Reset token is missing." };
        }
        if (!password || !passwordConfirm) {
          return { ok: false, error: "Enter and confirm your new password." };
        }
        if (password !== passwordConfirm) {
          return { ok: false, error: "Passwords do not match." };
        }
        try {
          const data = await resetPasswordApi(token.trim(), password, passwordConfirm);
          return { ok: true, detail: data.detail };
        } catch (err) {
          return {
            ok: false,
            error: toErrorMessage(err, "Unable to reset password."),
          };
        }
      },

      changePassword: async (oldPassword, password, passwordConfirm) => {
        const access = get().tokens?.access;
        if (!access) {
          return { ok: false, error: "Please sign in again." };
        }
        if (!oldPassword || !password || !passwordConfirm) {
          return { ok: false, error: "All password fields are required." };
        }
        if (password !== passwordConfirm) {
          return { ok: false, error: "Passwords do not match." };
        }
        try {
          const data = await changePasswordApi(access, oldPassword, password, passwordConfirm);
          return { ok: true, detail: data.detail };
        } catch (err) {
          return {
            ok: false,
            error: toErrorMessage(err, "Unable to change password."),
          };
        }
      },

      refreshSession: async () => {
        const refresh = get().tokens?.refresh;
        if (!refresh) return false;
        try {
          const data = await refreshAccessToken(refresh);
          set({
            tokens: {
              access: data.access,
              refresh,
            },
          });
          return true;
        } catch {
          set(clearSession());
          return false;
        }
      },

      getAccessToken: () => get().tokens?.access ?? null,
    }),
    {
      name: "daawat-auth",
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        panel: state.panel,
        business: state.business,
      }),
    },
  ),
);

export function isSuperAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "super_admin";
}

export function formatRoleLabel(role: string | undefined): string {
  if (!role) return "Admin";
  return role
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
