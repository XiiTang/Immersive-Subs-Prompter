import { SubtitleCacheSettings } from "../../types.js";
import { DEFAULT_CACHE_SETTINGS } from "../constants.js";

export function sanitizeCacheSettings(input: Partial<SubtitleCacheSettings> | null | undefined): SubtitleCacheSettings {
  const source = input ?? {};
  const enabled = typeof source.enabled === "boolean" ? source.enabled : DEFAULT_CACHE_SETTINGS.enabled;
  const path = typeof source.path === "string" && source.path.trim() ? source.path.trim() : DEFAULT_CACHE_SETTINGS.path;

  let retentionDays = Number(source.retentionDays);
  if (!Number.isFinite(retentionDays) || retentionDays < 1) {
    retentionDays = DEFAULT_CACHE_SETTINGS.retentionDays;
  }
  retentionDays = Math.min(9999, Math.max(1, Math.round(retentionDays)));

  return {
    enabled,
    path,
    retentionDays
  };
}
