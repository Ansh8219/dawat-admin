import { apiRequest } from "./client";
import type {
  CreateRewardTierPayload,
  RewardTier,
  RewardTierListData,
  UpdateRewardTierPayload,
} from "./types";

/** Key rules from the admin API: ^[a-z][a-z0-9_]*$ */
export const REWARD_TIER_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
export const REWARD_TIER_NAME_MAX = 100;
export const REWARD_TIER_KEY_MAX = 64;
export const REWARD_TIER_DESCRIPTION_MAX = 500;

export function listRewardTiers(accessToken: string) {
  return apiRequest<RewardTierListData>("/api/admin/reward-tiers/", {
    method: "GET",
    accessToken,
  });
}

export function getRewardTier(accessToken: string, publicId: string) {
  return apiRequest<RewardTier>(`/api/admin/reward-tiers/${publicId}/`, {
    method: "GET",
    accessToken,
  });
}

export function createRewardTier(accessToken: string, payload: CreateRewardTierPayload) {
  return apiRequest<RewardTier>("/api/admin/reward-tiers/", {
    method: "POST",
    accessToken,
    body: payload,
  });
}

export function updateRewardTier(
  accessToken: string,
  publicId: string,
  payload: UpdateRewardTierPayload,
) {
  return apiRequest<RewardTier>(`/api/admin/reward-tiers/${publicId}/`, {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}

export function deleteRewardTier(accessToken: string, publicId: string) {
  return apiRequest<void>(`/api/admin/reward-tiers/${publicId}/`, {
    method: "DELETE",
    accessToken,
  });
}

/** "Elite+" → "elite_plus" */
export function suggestTierKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .slice(0, REWARD_TIER_KEY_MAX)
    .replace(/_+$/, "");
}
