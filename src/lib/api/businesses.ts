import { apiRequest } from "./client";
import type { Business } from "./types";

export function listBusinesses(accessToken: string) {
  return apiRequest<Business[]>("/api/admin/businesses/", {
    method: "GET",
    accessToken,
  });
}
