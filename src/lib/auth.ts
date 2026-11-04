import { create } from "zustand";
import { persist } from "zustand/middleware";
import { onPasswordChangeRequired } from "./api/client";
import {
  adminLogin,
  changePassword as changePasswordApi,
  forgotPassword,
  getMe,
  getMyAccess,
  refreshAccessToken,
  resetPassword as resetPasswordApi,
} from "./api/auth";
import { ApiError } from "./api/types";
import type { AdminAccess, AuthUser as ApiAuthUser, Business } from "./api/types";
import { businessTypeToPanel, type Panel } from "./panel";

export interface AuthUser {
  publicId: string;
  email: string;
  role: string;
  isStaff: boolean;
  /** Temporary password in use — user must set a new one before anything else. */
  mustChangePassword: boolean;
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
  /** Role/permissions from GET /api/admin/me/access/. */
  access: AdminAccess | null;
  /** Fetches and stores access. Returns false if it could not be loaded. */
  loadAccess: () => Promise<boolean>;
  login: (
    email: string,
    password: string,
  ) => Promise<{ ok: true; mustChangePassword: boolean } | { ok: false; error: string }>;
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
  /** Flag the stored user as needing a password change (global 403 guard). */
  requirePasswordChange: () => void;
  /** Call after a successful password change; keeps the same tokens. */
  markPasswordChanged: () => void;
  refreshSession: () => Promise<boolean>;
  getAccessToken: () => string | null;
}

function isBrowser() {
  return typeof window !== "undefined";
}

/** Auth lives in localStorage — route guards must not run during SSR. */
export function canCheckPersistedAuth(): boolean {
  return isBrowser();
}

type PersistedAuthState = {
  user?: AuthUser | null;
  tokens?: AuthTokens | null;
  panel?: Panel | null;
  business?: SelectedBusiness | null;
  access?: AdminAccess | null;
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

function displayNameFromEmail(email: string | undefined | null): string {
  if (!email) return "Admin";
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function mapUser(user: ApiAuthUser): AuthUser {
  const email = user.email ?? "";
  return {
    publicId: user.public_id,
    email,
    role: user.role,
    isStaff: Boolean(user.is_staff),
    mustChangePassword: Boolean(user.must_change_password),
    name: displayNameFromEmail(email),
  };
}

function toErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

function clearSession() {
  return { user: null, tokens: null, panel: null, business: null, access: null } as const;
}

export function isAuthenticated(): boolean {
  const state = readPersistedAuthState();
  return Boolean(state?.user && state?.tokens?.access);
}

export function getSelectedPanel(): Panel | null {
  const state = readPersistedAuthState();
  if (!state) return null;
  const fromBusiness = state.business?.panel;
  if (fromBusiness === "bakery" || fromBusiness === "restaurant" || fromBusiness === "banquet") {
    return fromBusiness;
  }
  const panel = state.panel;
  if (panel === "bakery" || panel === "restaurant" || panel === "banquet") return panel;
  return null;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      panel: null,
      business: null,
      access: null,

      loadAccess: async () => {
        // Not using withAuthRetry here: it imports this store (cycle).
        let token = get().getAccessToken();
        if (!token) return false;
        try {
          let access: AdminAccess;
          try {
            access = await getMyAccess(token);
          } catch (err) {
            if (!(err instanceof ApiError) || err.status !== 401) throw err;
            if (!(await get().refreshSession())) return false;
            token = get().getAccessToken();
            if (!token) return false;
            access = await getMyAccess(token);
          }
          set({ access });
          return true;
        } catch {
          return false;
        }
      },

      login: async (email, password) => {
        const normalized = email.trim().toLowerCase();
        if (!normalized || !password) {
          return { ok: false, error: "Email and password are required." };
        }
        try {
          const data = await adminLogin(normalized, password);
          try {
            let apiUser = data.user;
            try {
              const me = await getMe(data.access);
              if (!me?.user) throw new Error("Admin profile response was incomplete.");
              apiUser = {
                ...me.user,
                must_change_password:
                  data.user?.must_change_password ?? me.user.must_change_password,
              };
            } catch (meErr) {
              // /me may be blocked while a temporary password is active; fall back to login's user.
              const blocked =
                meErr instanceof ApiError && meErr.code === "password_change_required";
              if (!blocked || !data.user) throw meErr;
            }
            const mapped = mapUser(apiUser);
            set({
              user: mapped,
              tokens: { access: data.access, refresh: data.refresh },
              panel: null,
              business: null,
            });
            if (!mapped.mustChangePassword) await get().loadAccess();
            return { ok: true, mustChangePassword: mapped.mustChangePassword };
          } catch (meErr) {
            set(clearSession());
            return {
              ok: false,
              error: toErrorMessage(meErr, "Unable to load admin profile."),
            };
          }
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
        if (password.length < 8) {
          return { ok: false, error: "Password must be at least 8 characters." };
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
          get().markPasswordChanged();
          await get().loadAccess();
          return { ok: true, detail: data.detail };
        } catch (err) {
          return {
            ok: false,
            error: toErrorMessage(err, "Unable to change password."),
          };
        }
      },

      requirePasswordChange: () => {
        const user = get().user;
        if (user && !user.mustChangePassword) set({ user: { ...user, mustChangePassword: true } });
      },

      markPasswordChanged: () => {
        const user = get().user;
        if (user) set({ user: { ...user, mustChangePassword: false } });
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

      getAccessToken: () =>
        get().tokens?.access ?? readPersistedAuthState()?.tokens?.access ?? null,
    }),
    {
      name: "daawat-auth",
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        panel: state.panel,
        business: state.business,
        access: state.access,
      }),
    },
  ),
);

// Global guard: any API call answering 403 `password_change_required` lands on the change screen.
onPasswordChangeRequired(() => {
  if (!isBrowser() || !useAuth.getState().user) return;
  useAuth.getState().requirePasswordChange();
  if (window.location.pathname !== "/change-password") {
    window.location.assign("/change-password");
  }
});

/** True when the persisted user still has a temporary password. */
export function mustChangePassword(): boolean {
  return Boolean(readPersistedAuthState()?.user?.mustChangePassword);
}

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
