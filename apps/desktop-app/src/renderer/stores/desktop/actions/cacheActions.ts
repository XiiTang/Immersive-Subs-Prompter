import type { SubtitleCacheSettings } from "../../../../main/types";
import type { DesktopStoreThis } from "../types";

export async function refreshCacheStats(this: DesktopStoreThis) {
  const stats = await window.usp.getCacheStats();
  this.cacheStats = stats;
  return stats;
}

export async function openCacheFolder(this: DesktopStoreThis) {
  return window.usp.openCacheFolder();
}

export function updateCacheSetting<Key extends keyof SubtitleCacheSettings>(
  this: DesktopStoreThis,
  key: Key,
  value: SubtitleCacheSettings[Key]
) {
  if (!this.settings) {
    return;
  }
  const nextCache = { ...this.settings.cache, [key]: value } as SubtitleCacheSettings;
  this.updateSettings({ cache: nextCache });
}

export const cacheActions = {
  refreshCacheStats,
  openCacheFolder,
  updateCacheSetting
};
