import { BLACKLIST_STORAGE_KEY } from "../shared/constants.js";
import { normalizeBlacklistRules } from "../shared/blacklist-utils.js";
import { log, state } from "../content/state.js";
import { isUrlBlacklisted } from "./URLMatcher.js";

export function setBlacklistRules(rawRules) {
  const normalized = normalizeBlacklistRules(rawRules ?? []);
  state.blacklistRules = normalized;
  state.regexCache.clear();
  return normalized;
}

export async function loadBlacklistRules() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([BLACKLIST_STORAGE_KEY], (result) => {
        if (chrome.runtime?.lastError) {
          log.logError("blacklist", "Failed to read blacklist", chrome.runtime.lastError);
          resolve([]);
          return;
        }
        resolve(result?.[BLACKLIST_STORAGE_KEY] ?? []);
      });
    } catch (error) {
      log.logError("blacklist", "Failed to read blacklist", error);
      resolve([]);
    }
  });
}

export function evaluateCurrentUrl() {
  const blocked = isUrlBlacklisted(location.href, state.blacklistRules);
  const changed = blocked !== state.isPageBlacklisted;
  state.isPageBlacklisted = blocked;
  return { blocked, changed };
}

export function handleStorageChange(changes, areaName) {
  if (areaName !== "local") {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(changes, BLACKLIST_STORAGE_KEY)) {
    return null;
  }

  setBlacklistRules(changes[BLACKLIST_STORAGE_KEY].newValue ?? []);
  return evaluateCurrentUrl();
}
