import { BLACKLIST_STORAGE_KEY } from "../shared/constants";
import { normalizeBlacklistRules } from "../shared/blacklist-utils";
import { log, state } from "../content/state";
import { isUrlBlacklisted } from "./URLMatcher";
import type { BlacklistRule, StorageChangeMap } from "../shared/types";

export function setBlacklistRules(rawRules: unknown): BlacklistRule[] {
  const normalized = normalizeBlacklistRules(rawRules ?? []);
  state.blacklistRules = normalized;
  return normalized;
}

export async function loadBlacklistRules(): Promise<unknown[]> {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([BLACKLIST_STORAGE_KEY], (result) => {
        if (chrome.runtime?.lastError) {
          log.error("blacklist", "Failed to read blacklist", chrome.runtime.lastError);
          resolve([]);
          return;
        }
        const stored = result?.[BLACKLIST_STORAGE_KEY];
        resolve(Array.isArray(stored) ? stored : []);
      });
    } catch (error) {
      log.error("blacklist", "Failed to read blacklist", error);
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

export function handleStorageChange(changes: StorageChangeMap, areaName: string) {
  if (areaName !== "local") {
    return null;
  }
  if (!Object.prototype.hasOwnProperty.call(changes, BLACKLIST_STORAGE_KEY)) {
    return null;
  }

  const storageChange = changes[BLACKLIST_STORAGE_KEY];
  if (!storageChange) {
    return null;
  }
  setBlacklistRules(storageChange.newValue ?? []);
  return evaluateCurrentUrl();
}
