<template>
  <section class="settings-section">
    <header class="settings-section__intro">
      <div>
        <h3 class="settings-section__title">{{ t("section-rules", "URL Rules") }}</h3>
      </div>
    </header>
    <div class="settings-split settings-surface settings-surface--split">
      <aside class="settings-split__sidebar" data-testid="rules-list">
        <div class="settings-split__sidebar-header">
          <span class="settings-field__label">{{ t("section-rules", "URL Rules") }}</span>
        </div>
        <template v-if="rules.length">
          <button
            v-for="(rule, index) in rules"
            :key="rule.id"
            type="button"
            class="rule-list__item"
            :class="{ 'is-selected': rule.id === ruleForm.id, 'is-disabled': !rule.isEnabled }"
            @click="editRule(rule)"
          >
            <span class="rule-list__name">{{ rule.name }}</span>
            <span class="rule-list__meta">{{ rule.pattern }}</span>
          </button>
        </template>
        <div v-else class="rule-list__empty">{{ t("rule-empty", "No rules") }}</div>
        <div class="settings-split__sidebar-actions">
          <button type="button" class="text-button" @click="resetRuleForm">
            + {{ t("rule-form-title", "Add Rule") }}
          </button>
        </div>
      </aside>

      <form class="settings-split__editor" data-testid="rules-editor" @submit.prevent="saveRule">
        <div class="rule-form__header">
          <span class="settings-field__label">
            {{ ruleForm.id ? t("rule-form-title-edit", "Edit rule") : t("rule-form-title", "Add Rule") }}
          </span>
          <div class="rule-item__actions" v-if="ruleForm.id">
            <button
              type="button"
              class="settings-action-btn"
              @click="toggleRule(ruleForm.id!, !ruleForm.isEnabled)"
            >
              {{ ruleForm.isEnabled ? t("rule-action-disable", "Disable") : t("rule-action-enable", "Enable") }}
            </button>
            <button
              type="button"
              class="settings-action-btn"
              :disabled="ruleIndex === 0"
              @click="moveRule(ruleForm.id!, 'up')"
            >
              {{ t("rule-action-move-up", "Move up") }}
            </button>
            <button
              type="button"
              class="settings-action-btn"
              :disabled="ruleIndex === rules.length - 1"
              @click="moveRule(ruleForm.id!, 'down')"
            >
              {{ t("rule-action-move-down", "Move down") }}
            </button>
            <button
              type="button"
              class="icon-button"
              :title="t('rule-action-delete', 'Delete')"
              :aria-label="t('rule-action-delete', 'Delete')"
              @click="deleteRule(ruleForm.id!)"
            >
              <IconDelete size="md" />
            </button>
          </div>
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
        <button class="btn-primary rule-form__submit" type="submit">
          {{ ruleForm.id ? t("rule-form-submit-save", "Save Rule") : t("rule-form-submit-add", "Add Rule") }}
        </button>
      </form>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { useDesktopStore } from "../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import type { ProfileRule, UrlMatchType } from "../../../main/types";
import { IconDelete } from "../icons";

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

const ruleIndex = computed(() => rules.value.findIndex((r) => r.id === ruleForm.id));

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
  ruleForm.isEnabled = enabled;
}

function deleteRule(id: string) {
  if (confirm(t("rule-delete-confirm", "Delete this rule?"))) {
    store.deleteRule(id);
    resetRuleForm();
  }
}

function moveRule(id: string, direction: "up" | "down") {
  store.moveRule(id, direction);
}
</script>
