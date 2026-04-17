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

export function moveRule(this: DesktopStoreThis, ruleId: string, direction: "up" | "down") {
  if (!this.settings) {
    return;
  }
  const rules = [...this.settings.rules];
  const index = rules.findIndex((rule) => rule.id === ruleId);
  if (index === -1) {
    return;
  }
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= rules.length) {
    return;
  }
  [rules[index], rules[targetIndex]] = [rules[targetIndex], rules[index]];
  this.updateSettings({ rules });
}

export const ruleActions = {
  addRule,
  updateRule,
  deleteRule,
  moveRule
};
