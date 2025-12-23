import { log, state } from "../content/state.js";

function compileRegex(pattern) {
  if (!pattern) {
    return null;
  }
  if (state.regexCache.has(pattern)) {
    return state.regexCache.get(pattern);
  }
  try {
    const regex = new RegExp(pattern);
    state.regexCache.set(pattern, regex);
    return regex;
  } catch (error) {
    log.warn("blacklist", "Invalid regex", { pattern });
    state.regexCache.set(pattern, null);
    return null;
  }
}

function matchesBlacklistRule(rule, url) {
  if (!rule || typeof rule.value !== "string" || !rule.value.length) {
    return false;
  }
  switch (rule.mode) {
    case "exact":
      return url === rule.value;
    case "regex": {
      const regex = compileRegex(rule.value);
      return regex ? regex.test(url) : false;
    }
    case "contains":
    default:
      return url.includes(rule.value);
  }
}

export function isUrlBlacklisted(url, rules = state.blacklistRules) {
  const target = typeof url === "string" ? url : "";
  if (!target) {
    return false;
  }
  return rules.some((rule) => matchesBlacklistRule(rule, target));
}
