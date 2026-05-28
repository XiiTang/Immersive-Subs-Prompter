import type { BlacklistRule } from "./types";

export function normalizeBlacklistRules(input: unknown): BlacklistRule[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const value = typeof entry.value === "string" ? entry.value.trim() : "";
      if (!value) {
        return null;
      }
      const id = typeof entry.id === "string" && entry.id.length ? entry.id : `rule-${index}`;
      return { id, value };
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
    return rule?.id === other?.id && rule?.value === other?.value;
  });
}
