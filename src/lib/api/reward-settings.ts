import { apiRequest } from "./client";
import type { EarnCalculation, RewardSettings, UpdateRewardSettingsPayload } from "./types";

export const COINS_PER_STEP_MAX = 100000;

export function getRewardSettings(accessToken: string) {
  return apiRequest<RewardSettings>("/api/admin/reward-settings/", {
    method: "GET",
    accessToken,
  });
}

export function updateRewardSettings(accessToken: string, payload: UpdateRewardSettingsPayload) {
  return apiRequest<RewardSettings>("/api/admin/reward-settings/", {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}

export type RewardSettingsForm = {
  is_enabled: boolean;
  earn_step_amount: string;
  coins_per_step: string;
  earn_calculation: EarnCalculation;
  min_order_amount: string;
  coin_value: string;
};

export type RewardSettingsField = keyof RewardSettingsForm;
export type RewardSettingsErrors = Partial<Record<RewardSettingsField, string>>;

export function rewardSettingsToForm(data: RewardSettings): RewardSettingsForm {
  return {
    is_enabled: data.is_enabled,
    earn_step_amount: String(data.earn_step_amount ?? ""),
    coins_per_step: String(data.coins_per_step ?? ""),
    earn_calculation: data.earn_calculation ?? "proportional",
    min_order_amount: String(data.min_order_amount ?? 0),
    coin_value: data.coin_value == null ? "" : String(data.coin_value),
  };
}

function decimalPlaces(raw: string): number {
  const dot = raw.indexOf(".");
  return dot === -1 ? 0 : raw.length - dot - 1;
}

function parseDecimal(
  raw: string,
  { min, inclusive, maxDecimals }: { min: number; inclusive: boolean; maxDecimals: number },
): { value: number } | { error: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { error: "This field is required." };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { error: "Enter a valid number." };
  const n = Number(trimmed);
  if (inclusive ? n < min : n <= min) {
    return { error: inclusive ? `Must be ${min} or more.` : `Must be greater than ${min}.` };
  }
  if (decimalPlaces(trimmed) > maxDecimals) {
    return { error: `Use at most ${maxDecimals} decimal places.` };
  }
  return { value: n };
}

/** Parses the form into settings values, or returns per-field errors. */
export function parseRewardSettingsForm(
  form: RewardSettingsForm,
): { ok: true; values: RewardSettings } | { ok: false; errors: RewardSettingsErrors } {
  const errors: RewardSettingsErrors = {};

  const step = parseDecimal(form.earn_step_amount, { min: 0, inclusive: false, maxDecimals: 2 });
  if ("error" in step) errors.earn_step_amount = step.error;

  const coinsRaw = form.coins_per_step.trim();
  const coins = Number(coinsRaw);
  if (!coinsRaw) errors.coins_per_step = "This field is required.";
  else if (!/^\d+$/.test(coinsRaw) || coins > COINS_PER_STEP_MAX)
    errors.coins_per_step = `Enter a whole number from 0 to ${COINS_PER_STEP_MAX.toLocaleString("en-IN")}.`;

  const minOrder = parseDecimal(form.min_order_amount, { min: 0, inclusive: true, maxDecimals: 2 });
  if ("error" in minOrder) errors.min_order_amount = minOrder.error;

  let coinValue: number | null = null;
  if (form.coin_value.trim() !== "") {
    const parsed = parseDecimal(form.coin_value, { min: 0, inclusive: false, maxDecimals: 4 });
    if ("error" in parsed) errors.coin_value = parsed.error;
    else coinValue = parsed.value;
  }

  if (Object.keys(errors).length > 0 || "error" in step || "error" in minOrder) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    values: {
      is_enabled: form.is_enabled,
      earn_step_amount: step.value,
      coins_per_step: coins,
      earn_calculation: form.earn_calculation,
      min_order_amount: minOrder.value,
      coin_value: coinValue,
    },
  };
}

/** Only the fields that differ from `original`. */
export function diffRewardSettings(
  values: RewardSettings,
  original: RewardSettings,
): UpdateRewardSettingsPayload {
  const patch: UpdateRewardSettingsPayload = {};
  if (values.is_enabled !== original.is_enabled) patch.is_enabled = values.is_enabled;
  if (values.earn_step_amount !== original.earn_step_amount)
    patch.earn_step_amount = values.earn_step_amount;
  if (values.coins_per_step !== original.coins_per_step)
    patch.coins_per_step = values.coins_per_step;
  if (values.earn_calculation !== original.earn_calculation)
    patch.earn_calculation = values.earn_calculation;
  if (values.min_order_amount !== original.min_order_amount)
    patch.min_order_amount = values.min_order_amount;
  if (values.coin_value !== (original.coin_value ?? null)) patch.coin_value = values.coin_value;
  return patch;
}

/** Floor that tolerates float noise (e.g. 2.9999999 from 0.1-based math). */
function safeFloor(n: number): number {
  return Math.floor(n + 1e-9);
}

/** Coins an order of `amount` would earn under `settings`. Mirrors the backend formula. */
export function previewCoins(
  amount: number,
  settings: Pick<
    RewardSettings,
    "is_enabled" | "earn_step_amount" | "coins_per_step" | "earn_calculation" | "min_order_amount"
  >,
): number {
  if (!settings.is_enabled) return 0;
  if (!(settings.earn_step_amount > 0)) return 0;
  if (amount < settings.min_order_amount) return 0;
  if (settings.earn_calculation === "full_steps") {
    return safeFloor(amount / settings.earn_step_amount) * settings.coins_per_step;
  }
  return safeFloor((amount * settings.coins_per_step) / settings.earn_step_amount);
}
