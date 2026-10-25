import { apiRequest } from "./client";
import type { BookingSettings, UpdateBookingSettingsPayload } from "./types";

export function getBookingSettings(accessToken: string) {
  return apiRequest<BookingSettings>("/api/admin/booking-settings/", {
    method: "GET",
    accessToken,
  });
}

export function updateBookingSettings(
  accessToken: string,
  payload: UpdateBookingSettingsPayload,
) {
  return apiRequest<BookingSettings>("/api/admin/booking-settings/", {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}

type RatePatchResult =
  | { ok: true; payload: UpdateBookingSettingsPayload }
  | { ok: false; error: string };

/** Validates a decimal string (>= 0, at most 2 places) and skips an unchanged rate. */
export function buildPerGuestRatePatch(input: string, original: string): RatePatchResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Per-guest rate is required." };
  if (trimmed.startsWith("-")) {
    return { ok: false, error: "Per-guest rate must be 0 or greater." };
  }
  if (/^\d+\.\d{3,}$/.test(trimmed)) {
    return { ok: false, error: "Per-guest rate can have at most 2 decimal places." };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, error: "Enter a valid per-guest rate." };
  }

  const normalized = Number(trimmed).toFixed(2);
  const originalNormalized = Number(original);
  if (Number.isFinite(originalNormalized) && Number(normalized) === originalNormalized) {
    return { ok: false, error: "No changes to save." };
  }

  return { ok: true, payload: { per_guest_rate: normalized } };
}
