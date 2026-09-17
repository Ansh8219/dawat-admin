import { apiRequest } from "./client";
import type { DeliverySettings, UpdateDeliverySettingsPayload } from "./types";

export type DeliverySettingsForm = {
  pickup_name: string;
  pickup_address: string;
  latitude: string;
  longitude: string;
  free_delivery_radius_km: string;
  per_km_rate: string;
  min_order_for_free_delivery: string;
};

export function getDeliverySettings(accessToken: string) {
  return apiRequest<DeliverySettings>("/api/admin/delivery-settings/", {
    method: "GET",
    accessToken,
  });
}

export function updateDeliverySettings(
  accessToken: string,
  payload: UpdateDeliverySettingsPayload,
) {
  return apiRequest<DeliverySettings>("/api/admin/delivery-settings/", {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}

export function settingsToForm(data: DeliverySettings): DeliverySettingsForm {
  return {
    pickup_name: data.pickup_name ?? "",
    pickup_address: data.pickup_address ?? "",
    latitude: data.latitude == null ? "" : String(data.latitude),
    longitude: data.longitude == null ? "" : String(data.longitude),
    free_delivery_radius_km: String(data.free_delivery_radius_km ?? 0),
    per_km_rate: String(data.per_km_rate ?? 0),
    min_order_for_free_delivery: String(data.min_order_for_free_delivery ?? 0),
  };
}

type PatchResult =
  { ok: true; payload: UpdateDeliverySettingsPayload } | { ok: false; error: string };

function parseOptionalCoord(
  raw: string,
  label: string,
): { value: number | null } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { error: `${label} must be a number.` };
  return { value: n };
}

function parseNonNegative(raw: string, label: string): { value: number } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { error: `${label} is required.` };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { error: `${label} must be a number.` };
  if (n < 0) return { error: `${label} must be 0 or greater.` };
  return { value: n };
}

function sameNullableNumber(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a === b;
}

/** Builds a PATCH body with only changed fields. Enforces lat/lng pairing. */
export function buildDeliverySettingsPatch(
  form: DeliverySettingsForm,
  original: DeliverySettings,
): PatchResult {
  const payload: UpdateDeliverySettingsPayload = {};

  const name = form.pickup_name.trim();
  if (name !== (original.pickup_name ?? "")) {
    payload.pickup_name = name.length ? name : null;
  }

  const address = form.pickup_address.trim();
  if (address !== (original.pickup_address ?? "")) {
    payload.pickup_address = address.length ? address : null;
  }

  const lat = parseOptionalCoord(form.latitude, "Latitude");
  if ("error" in lat) return { ok: false, error: lat.error };
  const lng = parseOptionalCoord(form.longitude, "Longitude");
  if ("error" in lng) return { ok: false, error: lng.error };

  if ((lat.value == null) !== (lng.value == null)) {
    return {
      ok: false,
      error: "Set both latitude and longitude, or leave both empty.",
    };
  }

  if (
    !sameNullableNumber(lat.value, original.latitude) ||
    !sameNullableNumber(lng.value, original.longitude)
  ) {
    payload.latitude = lat.value;
    payload.longitude = lng.value;
  }

  const radius = parseNonNegative(form.free_delivery_radius_km, "Free delivery radius");
  if ("error" in radius) return { ok: false, error: radius.error };
  if (radius.value !== (original.free_delivery_radius_km ?? 0)) {
    payload.free_delivery_radius_km = radius.value;
  }

  const rate = parseNonNegative(form.per_km_rate, "Per-km rate");
  if ("error" in rate) return { ok: false, error: rate.error };
  if (rate.value !== (original.per_km_rate ?? 0)) {
    payload.per_km_rate = rate.value;
  }

  const minOrder = parseNonNegative(
    form.min_order_for_free_delivery,
    "Min order for free delivery",
  );
  if ("error" in minOrder) return { ok: false, error: minOrder.error };
  if (minOrder.value !== (original.min_order_for_free_delivery ?? 0)) {
    payload.min_order_for_free_delivery = minOrder.value;
  }

  if (Object.keys(payload).length === 0) {
    return { ok: false, error: "No changes to save." };
  }

  return { ok: true, payload };
}
