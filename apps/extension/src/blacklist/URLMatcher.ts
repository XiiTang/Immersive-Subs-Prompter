import { state } from "../content/state";
import { matchesUrlRule } from "@immersive-subs/contracts";
import type { BlacklistRule } from "../shared/types";

function matchesBlacklistRule(rule: BlacklistRule, url: string) {
  if (!rule || typeof rule.value !== "string" || !rule.value.length) {
    return false;
  }
  return matchesUrlRule(url, rule.value);
}

export function isUrlBlacklisted(url: string, rules: BlacklistRule[] = state.blacklistRules) {
  const target = typeof url === "string" ? url : "";
  if (!target) {
    return false;
  }
  return rules.some((rule) => matchesBlacklistRule(rule, target));
}
