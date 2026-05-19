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

export function moveProfileRule(
  this: DesktopStoreThis,
  profileId: string,
  ruleId: string,
  direction: "up" | "down"
) {
  if (!this.settings) {
    return;
  }
  const profileRules = this.settings.rules.filter((rule) => rule.profileId === profileId);
  const index = profileRules.findIndex((rule) => rule.id === ruleId);
  if (index === -1) {
    return;
  }
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= profileRules.length) {
    return;
  }
  [profileRules[index], profileRules[targetIndex]] = [profileRules[targetIndex], profileRules[index]];

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
  moveProfileRule
};
