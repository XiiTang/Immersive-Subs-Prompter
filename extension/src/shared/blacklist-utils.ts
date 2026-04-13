import type { BlacklistMode, BlacklistRule } from "./types";

const BLACKLIST_MODES = Object.freeze(["contains", "exact", "regex"] satisfies BlacklistMode[]);
const BLACKLIST_MODE_SET = new Set(BLACKLIST_MODES);

export function normalizeBlacklistRules(input: unknown): BlacklistRule[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const id = typeof entry.id === "string" && entry.id.length ? entry.id : `rule-${Date.now()}-${index}`;
      const mode =
        typeof entry.mode === "string" && BLACKLIST_MODE_SET.has(entry.mode as BlacklistMode)
          ? (entry.mode as BlacklistMode)
          : "contains";
      const value = typeof entry.value === "string" ? entry.value.trim() : "";
      return { id, mode, value };
    })
    .filter((rule): rule is BlacklistRule => rule !== null);
}

export function areBlacklistRulesEqual(a: unknown, b: unknown): boolean {
  const left = Array.isArray(a) ? (a as BlacklistRule[]) : [];
  const right = Array.isArray(b) ? (b as BlacklistRule[]) : [];
  if (left.length !== right.length) {
    return false;
  }
  return left.every((rule, index) => {
    const other = right[index];
    return rule?.id === other?.id && rule?.mode === other?.mode && rule?.value === other?.value;
  });
}

export { BLACKLIST_MODES };
