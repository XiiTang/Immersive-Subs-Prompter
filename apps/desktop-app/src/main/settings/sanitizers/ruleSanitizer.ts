import { ProfileDefinition, ProfileRule, UrlMatchType } from "../../types.js";
import { MATCH_TYPES } from "../constants.js";
import { ensureUniqueId } from "../utils.js";

function isMatchType(value: unknown): value is UrlMatchType {
  return typeof value === "string" && MATCH_TYPES.includes(value as UrlMatchType);
}

export function sanitizeRules(raw: unknown, profiles: ProfileDefinition[], fallbackProfileId: string): ProfileRule[] {
  if (!Array.isArray(raw) || !profiles.length) {
    return [];
  }
  const profileIds = new Set(
    profiles.filter((profile) => profile.id !== fallbackProfileId).map((profile) => profile.id)
  );
  const used = new Set<string>();
  const rules: ProfileRule[] = [];

  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object") {
      continue;
    }
    const source = candidate as Partial<ProfileRule>;
    const pattern = typeof source.pattern === "string" ? source.pattern.trim() : "";
    if (!pattern.length) {
      continue;
    }
    const id = ensureUniqueId(source.id, used, "rule");
    const matchType = isMatchType(source.matchType) ? source.matchType : "contains";
    const profileId = typeof source.profileId === "string" ? source.profileId : "";
    if (!profileIds.has(profileId)) {
      continue;
    }
    const name = typeof source.name === "string" && source.name.trim().length ? source.name.trim() : pattern;
    const isEnabled = typeof source.isEnabled === "boolean" ? source.isEnabled : true;
    rules.push({
      id,
      name,
      pattern,
      matchType,
      profileId,
      isEnabled
    });
  }

  return rules;
}
