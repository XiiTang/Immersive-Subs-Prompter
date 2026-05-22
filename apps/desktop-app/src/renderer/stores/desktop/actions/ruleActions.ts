import type { ProfileRule } from "../../../../main/types";
import { createId, mergePartial } from "../helpers";
import type { DesktopStoreThis } from "../types";

export function addRule(this: DesktopStoreThis, payload: Omit<ProfileRule, "id">) {
  if (!this.settings) {
    return;
  }
  const rule: ProfileRule = { ...payload, id: createId("rule") };
  this.updateSettings({
    rules: [...this.settings.rules, rule]
  });
}

export function updateRule(this: DesktopStoreThis, ruleId: string, patch: Partial<ProfileRule>) {
  if (!this.settings) {
    return;
  }
  const nextRules = this.settings.rules.map((rule) =>
    rule.id === ruleId ? mergePartial(rule, patch) : rule
  );
  this.updateSettings({ rules: nextRules });
}

export function deleteRule(this: DesktopStoreThis, ruleId: string) {
  if (!this.settings) {
    return;
  }
  const nextRules = this.settings.rules.filter((rule) => rule.id !== ruleId);
  this.updateSettings({ rules: nextRules });
}

export function reorderProfileRule(
  this: DesktopStoreThis,
  profileId: string,
  fromIndex: number,
  toIndex: number
) {
  if (!this.settings || fromIndex === toIndex) return;
  const profileRules = this.settings.rules.filter((rule) => rule.profileId === profileId);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= profileRules.length ||
    toIndex >= profileRules.length
  ) {
    return;
  }
  const [moved] = profileRules.splice(fromIndex, 1);
  profileRules.splice(toIndex, 0, moved);

  let nextProfileRuleIndex = 0;
  const nextRules = this.settings.rules.map((rule) => {
    if (rule.profileId !== profileId) {
      return rule;
    }
    return profileRules[nextProfileRuleIndex++]!;
  });

  this.updateSettings({ rules: nextRules });
}

export const ruleActions = {
  addRule,
  updateRule,
  deleteRule,
  reorderProfileRule
};
