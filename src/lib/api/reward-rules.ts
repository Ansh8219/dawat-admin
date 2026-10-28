import { apiRequest } from "./client";
import type { RewardRule, RewardRuleListData, UpdateRewardRulePayload } from "./types";

export const REWARD_RULE_TITLE_MAX = 100;
export const REWARD_RULE_DESCRIPTION_MAX = 500;
export const REWARD_RULE_COINS_MAX = 100000;

/** Admin-facing explanation per trigger. */
export const REWARD_RULE_HELP: Record<string, string> = {
  review: "Given once per order when the customer rates the order or reviews any dish.",
};

export function listRewardRules(accessToken: string) {
  return apiRequest<RewardRuleListData>("/api/admin/reward-rules/", {
    method: "GET",
    accessToken,
  });
}

export function updateRewardRule(
  accessToken: string,
  trigger: string,
  payload: UpdateRewardRulePayload,
) {
  return apiRequest<RewardRule>(`/api/admin/reward-rules/${encodeURIComponent(trigger)}/`, {
    method: "PATCH",
    accessToken,
    body: payload,
  });
}
