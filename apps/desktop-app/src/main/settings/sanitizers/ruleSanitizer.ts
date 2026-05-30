import { ProfileDefinition, ProfileRule } from "../../types.js";
import { assertNoUnknownKeys } from "../utils.js";

const RULE_KEYS = ["id", "name", "pattern", "profileId"] as const;
import { ensureUniqueId } from "../utils.js";

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
    const profileId = typeof source.profileId === "string" ? source.profileId : "";
    if (!profileIds.has(profileId)) {
      continue;
    }
    const name = typeof source.name === "string" && source.name.trim().length ? source.name.trim() : pattern;
    rules.push({
      id,
      name,
      pattern,
      profileId
    });
  }

  return rules;
}

export function validateRulesForUpdate(
  raw: unknown,
  profiles: ProfileDefinition[],
  fallbackProfileId: string
): void {
  if (!Array.isArray(raw)) {
    throw new Error("rules must use the current array setting");
  }

  const profileIds = new Set(
    profiles.filter((profile) => profile.id !== fallbackProfileId).map((profile) => profile.id)
  );
  const used = new Set<string>();

  for (const candidate of raw) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error("rule must use the current object setting");
    }
    const source = candidate as Record<string, unknown>;
    assertNoUnknownKeys(source, RULE_KEYS, "rule");
    const id = typeof source.id === "string" ? source.id.trim() : "";
    if (!id) {
      throw new Error("rule.id must use the current string setting");
    }
    if (used.has(id)) {
      throw new Error(`duplicate rule id: ${id}`);
    }
    used.add(id);

    if (typeof source.name !== "string" || !source.name.trim()) {
      throw new Error("rule.name must use the current string setting");
    }
    if (typeof source.pattern !== "string" || !source.pattern.trim()) {
      throw new Error("rule.pattern must use the current string setting");
    }
    if (typeof source.profileId !== "string" || !profileIds.has(source.profileId)) {
      throw new Error("rule.profileId must reference a non-fallback profile");
    }
  }
}
