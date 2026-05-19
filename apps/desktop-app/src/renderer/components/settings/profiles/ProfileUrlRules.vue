<template>
  <section class="profile-url-rules" data-testid="profile-url-rules">
    <header class="profile-url-rules__header">
      <div>
        <span class="settings-field__label">{{ t("profile-url-rules-label", "Applies to these URLs") }}</span>
        <p class="profile-url-rules__hint">
          {{
            isDefaultProfile
              ? t("profile-url-default-hint", "This profile is used when no URL rule matches.")
              : t(
                "profile-url-rules-hint",
                "Rules match in listed order. Profile order controls cross-profile priority."
              )
          }}
        </p>
      </div>
    </header>

    <div v-if="isDefaultProfile" class="profile-url-rules__fallback">
      {{ t("profile-url-default-summary", "Fallback") }}
    </div>

    <template v-else>
      <div class="profile-url-rules__list">
        <article
          v-for="(rule, index) in rules"
          :key="rule.id"
          class="profile-url-rule"
          :class="{ 'is-disabled': !rule.isEnabled }"
        >
          <div class="profile-url-rule__main">
            <span class="profile-url-rule__pattern">{{ rule.pattern }}</span>
            <span class="profile-url-rule__meta">{{ matchTypeLabel(rule.matchType) }}</span>
          </div>
          <div class="profile-url-rule__actions">
            <label class="toggle toggle--sm">
              <input
                type="checkbox"
                :checked="rule.isEnabled"
                @change="toggleRule(rule.id, ($event.target as HTMLInputElement).checked)"
              />
              <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
            </label>
            <button
              type="button"
              class="settings-action-btn"
              :disabled="index === 0"
              @click="store.moveProfileRule(profileId, rule.id, 'up')"
            >
              {{ t("rule-action-move-up", "Move up") }}
            </button>
            <button
              type="button"
              class="settings-action-btn"
              :disabled="index === rules.length - 1"
              @click="store.moveProfileRule(profileId, rule.id, 'down')"
            >
              {{ t("rule-action-move-down", "Move down") }}
            </button>
            <button type="button" class="settings-action-btn" @click="editRule(rule)">
              {{ t("rule-action-edit", "Edit") }}
            </button>
            <button
              type="button"
              class="icon-button"
              :title="t('rule-action-delete', 'Delete')"
              :aria-label="t('rule-action-delete', 'Delete')"
              @click="deleteRule(rule.id)"
            >
              <IconDelete size="md" />
            </button>
          </div>
        </article>
        <div v-if="!rules.length" class="profile-url-rules__empty">
          {{ t("profile-url-empty", "No URL rules") }}
        </div>
      </div>

      <form class="profile-url-rule-form" @submit.prevent="saveRule">
        <div class="profile-url-rule-form__grid">
          <label class="settings-field">
            <span class="settings-field__label">{{ t("rule-match-label", "Match Type") }}</span>
            <select v-model="ruleForm.matchType">
              <option value="contains">{{ t("rule-match-contains", "Contains") }}</option>
              <option value="exact">{{ t("rule-match-exact", "Exact Match") }}</option>
              <option value="regex">{{ t("rule-match-regex", "Regex") }}</option>
            </select>
          </label>
          <label class="settings-field profile-url-rule-form__pattern">
            <span class="settings-field__label">{{ t("rule-pattern-label", "Pattern") }}</span>
            <input type="text" v-model="ruleForm.pattern" autocomplete="off" />
          </label>
          <div class="settings-field settings-field--inline settings-field--justify-start">
            <span class="settings-field__label">{{ t("rule-action-enable", "Enable") }}</span>
            <label class="toggle">
              <input type="checkbox" v-model="ruleForm.isEnabled" />
              <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
            </label>
          </div>
        </div>
        <div v-if="regexError" class="settings-field__error">{{ regexError }}</div>
        <div class="profile-url-rule-form__actions">
          <button class="btn-primary rule-form__submit" type="submit" :disabled="!canSave">
            {{ ruleForm.id ? t("profile-url-save", "Save URL Rule") : t("profile-url-add", "Add URL Rule") }}
          </button>
          <button v-if="ruleForm.id" type="button" class="text-button" @click="resetRuleForm">
            {{ t("button-cancel", "Cancel") }}
          </button>
        </div>
      </form>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { isValidRegex } from "../../../../common/regex.js";
import type { ProfileRule, UrlMatchType } from "../../../../main/types.js";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import { useDesktopStore } from "../../../stores/desktop";
import { IconDelete } from "../../icons";

const props = defineProps<{
  profileId: string;
  isDefaultProfile: boolean;
  rules: readonly ProfileRule[];
}>();

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const ruleForm = reactive<{
  id: string | null;
  matchType: UrlMatchType;
  pattern: string;
  isEnabled: boolean;
}>({
  id: null,
  matchType: "contains",
  pattern: "",
  isEnabled: true
});

const regexError = computed(() => {
  if (ruleForm.matchType !== "regex" || !ruleForm.pattern.trim()) {
    return null;
  }
  return isValidRegex(ruleForm.pattern) ? null : t("rule-regex-invalid", "Invalid regular expression");
});

const canSave = computed(() => Boolean(ruleForm.pattern.trim()) && !regexError.value);

watch(
  () => props.profileId,
  () => resetRuleForm()
);

function matchTypeLabel(matchType: UrlMatchType): string {
  if (matchType === "exact") {
    return t("rule-match-exact", "Exact Match");
  }
  if (matchType === "regex") {
    return t("rule-match-regex", "Regex");
  }
  return t("rule-match-contains", "Contains");
}

function saveRule() {
  if (!canSave.value) {
    return;
  }
  const pattern = ruleForm.pattern.trim();
  const payload = {
    name: pattern,
    matchType: ruleForm.matchType,
    pattern,
    profileId: props.profileId,
    isEnabled: ruleForm.isEnabled
  };

  if (ruleForm.id) {
    store.updateRule(ruleForm.id, payload);
  } else {
    store.addRule(payload);
  }
  resetRuleForm();
}

function editRule(rule: ProfileRule) {
  ruleForm.id = rule.id;
  ruleForm.matchType = rule.matchType;
  ruleForm.pattern = rule.pattern;
  ruleForm.isEnabled = rule.isEnabled;
}

function toggleRule(ruleId: string, isEnabled: boolean) {
  store.updateRule(ruleId, { isEnabled });
}

function deleteRule(ruleId: string) {
  if (confirm(t("rule-delete-confirm", "Delete this rule?"))) {
    store.deleteRule(ruleId);
    if (ruleForm.id === ruleId) {
      resetRuleForm();
    }
  }
}

function resetRuleForm() {
  ruleForm.id = null;
  ruleForm.matchType = "contains";
  ruleForm.pattern = "";
  ruleForm.isEnabled = true;
}
</script>
