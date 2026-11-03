import { apiRequest } from "./client";
import type { DeliverySettings, UpdateDeliverySettingsPayload } from "./types";

export type DeliverySettingsForm = {
  pickup_name: string;
  pickup_address: string;
  latitude: string;
  longitude: string;
  per_km_rate: string;
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
    per_km_rate: formatRate(data.per_km_rate ?? 0),
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

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatRate(n: number): string {
  return roundMoney(n).toFixed(2);
}

/** Per-km rate: rupees, >= 0, two decimal places. */
function parsePerKmRate(raw: string): { value: number } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { error: "Per-km rate is required." };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { error: "Per-km rate must be a number." };
  if (n < 0) return { error: "Per-km rate must be 0 or greater." };
  return { value: roundMoney(n) };
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

  const rate = parsePerKmRate(form.per_km_rate);
  if ("error" in rate) return { ok: false, error: rate.error };
  if (rate.value !== roundMoney(original.per_km_rate ?? 0)) {
    payload.per_km_rate = rate.value;
  }

  if (Object.keys(payload).length === 0) {
    return { ok: false, error: "No changes to save." };
  }

  return { ok: true, payload };
}
