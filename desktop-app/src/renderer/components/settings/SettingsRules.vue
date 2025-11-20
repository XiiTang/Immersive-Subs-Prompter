<template>
  <section class="settings-section">
    <h3 class="settings-section__title">{{ t("section-rules", "URL Rules") }}</h3>
    <div class="rule-list">
      <template v-if="rules.length">
        <div
          v-for="(rule, index) in rules"
          :key="rule.id"
          class="rule-item"
          :class="{ 'is-disabled': !rule.isEnabled }"
        >
          <div class="rule-item__header">
            <div>
              <div class="rule-item__title">{{ rule.name }}</div>
              <div class="rule-item__meta">{{ rule.pattern }} ({{ matchTypeLabel(rule.matchType) }})</div>
            </div>
            <div class="rule-item__actions">
              <button
                type="button"
                class="rule-item__action"
                @click="toggleRule(rule.id, !rule.isEnabled)"
              >
                {{ rule.isEnabled ? t("rule-action-disable", "Disable") : t("rule-action-enable", "Enable") }}
              </button>
              <button type="button" class="rule-item__action" @click="editRule(rule)">
                {{ t("rule-action-edit", "Edit") }}
              </button>
              <button
                type="button"
                class="rule-item__action"
                :disabled="index === 0"
                @click="moveRule(rule.id, 'up')"
              >
                {{ t("rule-action-move-up", "Move up") }}
              </button>
              <button
                type="button"
                class="rule-item__action"
                :disabled="index === rules.length - 1"
                @click="moveRule(rule.id, 'down')"
              >
                {{ t("rule-action-move-down", "Move down") }}
              </button>
              <button type="button" class="rule-item__action" @click="deleteRule(rule.id)">
                {{ t("rule-action-delete", "Delete") }}
              </button>
            </div>
          </div>
          <div class="rule-item__meta">
            {{ t("rule-apply-prefix", "Apply profile:") }} {{ profileNameById(rule.profileId) }}
          </div>
        </div>
      </template>
      <div v-else class="rule-list__empty">{{ t("rule-empty", "No rules") }}</div>
    </div>

    <form class="rule-form" @submit.prevent="saveRule">
      <div class="rule-form__header">
        <span class="settings-field__label">
          {{ ruleForm.id ? t("rule-form-title-edit", "Edit rule") : t("rule-form-title", "Add Rule") }}
        </span>
        <button type="button" class="text-button" @click="resetRuleForm">
          {{ t("rule-cancel", "Cancel edit") }}
        </button>
      </div>
      <label class="settings-field">
        <span class="settings-field__label">{{ t("rule-name-label", "Rule Name") }}</span>
        <input type="text" v-model="ruleForm.name" />
      </label>
      <label class="settings-field">
        <span class="settings-field__label">{{ t("rule-match-label", "Match Type") }}</span>
        <select v-model="ruleForm.matchType">
          <option value="contains">{{ t("rule-match-contains", "Contains") }}</option>
          <option value="exact">{{ t("rule-match-exact", "Exact Match") }}</option>
          <option value="regex">{{ t("rule-match-regex", "Regex") }}</option>
        </select>
      </label>
      <label class="settings-field">
        <span class="settings-field__label">{{ t("rule-pattern-label", "Pattern") }}</span>
        <input type="text" v-model="ruleForm.pattern" />
      </label>
      <label class="settings-field">
        <span class="settings-field__label">{{ t("rule-apply-profile-label", "Apply Profile") }}</span>
        <select v-model="ruleForm.profileId">
          <option
            v-for="profile in profiles"
            :key="profile.id"
            :value="profile.id"
          >
            {{ profile.name }}
          </option>
        </select>
      </label>
      <div class="settings-field settings-field--inline">
        <span class="settings-field__label">{{ t("rule-action-enable", "Enable") }}</span>
        <label class="toggle">
          <input type="checkbox" v-model="ruleForm.isEnabled" />
          <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
        </label>
      </div>
      <button class="rule-form__submit" type="submit">
        {{ ruleForm.id ? t("rule-form-submit-save", "Save Rule") : t("rule-form-submit-add", "Add Rule") }}
      </button>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import type { ProfileRule, UrlMatchType } from "../../main/types";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const rules = computed(() => store.settings?.rules ?? []);
const profiles = computed(() => store.settings?.profiles ?? []);

const ruleForm = reactive<{
  id: string | null;
  name: string;
  matchType: UrlMatchType;
  pattern: string;
  profileId: string;
  isEnabled: boolean;
}>({
  id: null,
  name: "",
  matchType: "contains",
  pattern: "",
  profileId: "",
  isEnabled: true
});

function matchTypeLabel(type: UrlMatchType) {
  switch (type) {
    case "contains":
      return t("rule-match-contains", "Contains");
    case "exact":
      return t("rule-match-exact", "Exact Match");
    case "regex":
      return t("rule-match-regex", "Regex");
    default:
      return type;
  }
}

function profileNameById(id: string) {
  return profiles.value.find((p) => p.id === id)?.name ?? id;
}

function resetRuleForm() {
  ruleForm.id = null;
  ruleForm.name = "";
  ruleForm.matchType = "contains";
  ruleForm.pattern = "";
  ruleForm.profileId = profiles.value[0]?.id ?? "";
  ruleForm.isEnabled = true;
}

function editRule(rule: ProfileRule) {
  ruleForm.id = rule.id;
  ruleForm.name = rule.name;
  ruleForm.matchType = rule.matchType;
  ruleForm.pattern = rule.pattern;
  ruleForm.profileId = rule.profileId;
  ruleForm.isEnabled = rule.isEnabled;
}

function saveRule() {
  if (!ruleForm.name || !ruleForm.pattern || !ruleForm.profileId) {
    return;
  }
  if (ruleForm.id) {
    store.updateRule(ruleForm.id, {
      name: ruleForm.name,
      matchType: ruleForm.matchType,
      pattern: ruleForm.pattern,
      profileId: ruleForm.profileId,
      isEnabled: ruleForm.isEnabled
    });
  } else {
    store.addRule({
      name: ruleForm.name,
      matchType: ruleForm.matchType,
      pattern: ruleForm.pattern,
      profileId: ruleForm.profileId,
      isEnabled: ruleForm.isEnabled
    });
  }
  resetRuleForm();
}

function toggleRule(id: string, enabled: boolean) {
  store.updateRule(id, { isEnabled: enabled });
}

function deleteRule(id: string) {
  if (confirm(t("rule-delete-confirm", "Delete this rule?"))) {
    store.deleteRule(id);
  }
}

function moveRule(id: string, direction: "up" | "down") {
  store.moveRule(id, direction);
}
</script>
