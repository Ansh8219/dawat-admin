import { apiRequest } from "./client";
import { ApiError } from "./types";

export type AccountKind = "manager" | "store_keeper" | "driver";

export interface AccountStatusResult {
  public_id: string;
  is_active: boolean;
}

const STATUS_PATH: Record<AccountKind, string> = {
  manager: "managers",
  store_keeper: "store-keepers",
  driver: "partners",
};

/** PATCH /api/admin/{managers|store-keepers|partners}/{public_id}/status/ (super_admin only) */
export function setAccountActive(
  accessToken: string,
  kind: AccountKind,
  publicId: string,
  isActive: boolean,
) {
  return apiRequest<AccountStatusResult>(`/api/admin/${STATUS_PATH[kind]}/${publicId}/status/`, {
    method: "PATCH",
    accessToken,
    body: { is_active: isActive },
  });
}

/** DELETE /api/admin/managers/{public_id}/ (super_admin only). Only managers can be deleted. */
export function deleteManager(accessToken: string, publicId: string) {
  return apiRequest<{ detail: string }>(`/api/admin/managers/${publicId}/`, {
    method: "DELETE",
    accessToken,
  });
}

export const MANAGER_IN_USE_MESSAGE =
  "This manager has records that must be kept. Deactivate the account instead.";

export type AccountErrorKind = "not_found" | "in_use" | "forbidden" | "other";

export function classifyAccountError(err: unknown): AccountErrorKind {
  if (!(err instanceof ApiError)) return "other";
  if (err.status === 404 || err.code === "manager_not_found" || err.code === "not_found") {
    return "not_found";
  }
  if (err.status === 409 && err.code === "manager_in_use") return "in_use";
  if (err.status === 403) return "forbidden";
  return "other";
}

export function accountErrorMessage(kind: AccountErrorKind): string {
  switch (kind) {
    case "not_found":
      return "Account not found. It may have been removed.";
    case "in_use":
      return MANAGER_IN_USE_MESSAGE;
    case "forbidden":
      return "You do not have permission to do this.";
    default:
      return "Something went wrong. Please try again.";
  }
}
