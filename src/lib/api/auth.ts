import { apiRequest } from "./client";
import type { DetailData, LoginData, MeData, RefreshData } from "./types";

export function adminLogin(email: string, password: string) {
  return apiRequest<LoginData>("/api/auth/admin/login/", {
    method: "POST",
    body: { email, password },
  });
}

/** Current session profile — same access token from login. Staff: `{ user }`. */
export function getMe(accessToken: string) {
  return apiRequest<MeData>("/api/auth/me/", {
    method: "GET",
    accessToken,
  });
}

export function forgotPassword(email: string) {
  return apiRequest<DetailData>("/api/auth/admin/password/forgot/", {
    method: "POST",
    body: { email },
  });
}

export function resetPassword(token: string, password: string, passwordConfirm: string) {
  return apiRequest<DetailData>("/api/auth/admin/password/reset/", {
    method: "POST",
    body: {
      token,
      password,
      password_confirm: passwordConfirm,
    },
  });
}

export function changePassword(
  accessToken: string,
  oldPassword: string,
  password: string,
  passwordConfirm: string,
) {
  return apiRequest<DetailData>("/api/auth/admin/password/change/", {
    method: "POST",
    accessToken,
    body: {
      old_password: oldPassword,
      password,
      password_confirm: passwordConfirm,
    },
  });
}

export function refreshAccessToken(refresh: string) {
  return apiRequest<RefreshData>("/api/auth/token/refresh/", {
    method: "POST",
    body: { refresh },
  });
}
