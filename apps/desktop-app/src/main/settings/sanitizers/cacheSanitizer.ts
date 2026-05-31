import { assertNoUnknownKeys } from "../utils.js";

const CACHE_SETTINGS_KEYS = ["enabled", "path", "retentionDays"] as const;

export function validateCacheSettingsForUpdate(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("cache settings must use the current object setting");
  }

  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, CACHE_SETTINGS_KEYS, "cache");
  if (Object.prototype.hasOwnProperty.call(source, "enabled") && typeof source.enabled !== "boolean") {
    throw new Error("cache.enabled must use the current boolean setting");
  }
  if (Object.prototype.hasOwnProperty.call(source, "path") && typeof source.path !== "string") {
    throw new Error("cache.path must use the current string setting");
  }
  if (Object.prototype.hasOwnProperty.call(source, "retentionDays")) {
    if (typeof source.retentionDays !== "number" || !Number.isFinite(source.retentionDays)) {
      throw new Error("cache.retentionDays must use the current finite number setting");
    }
    if (source.retentionDays < 1 || source.retentionDays > 9999) {
      throw new Error("cache.retentionDays must be between 1 and 9999");
    }
  }
}
