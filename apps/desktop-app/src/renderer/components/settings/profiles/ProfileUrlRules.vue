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
          :class="{ 'is-disabled': !rule.isEnabled, 'is-drag-over': dragOverIndex === index }"
          draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragover.prevent="dragOverIndex = index"
          @dragleave="dragOverIndex = null"
          @drop.prevent="onDrop(index)"
          @dragend="resetDrag"
        >
          <label
            class="profile-url-rule__toggle"
            :title="rule.isEnabled ? t('toggle-on', 'On') : t('toggle-off', 'Off')"
          >
            <input
              type="checkbox"
              :checked="rule.isEnabled"
              @change="toggleRule(rule.id, ($event.target as HTMLInputElement).checked)"
            />
          </label>
          <div class="profile-url-rule__fields">
            <label class="profile-url-rule__field">
              <select
                class="profile-url-rule__match-select"
                data-testid="profile-url-rule-match-type"
                :value="rule.matchType"
                :aria-label="t('rule-match-label', 'Match Type')"
                @change="updateRuleMatchType(rule.id, ($event.target as HTMLSelectElement).value)"
                @mousedown.stop
              >
                <option value="contains">{{ t("rule-match-contains", "Contains") }}</option>
                <option value="exact">{{ t("rule-match-exact", "Exact Match") }}</option>
                <option value="regex">{{ t("rule-match-regex", "Regex") }}</option>
              </select>
            </label>
            <label class="profile-url-rule__field profile-url-rule__field--pattern">
              <input
                data-testid="profile-url-rule-pattern"
                type="text"
                :value="rule.pattern"
                :placeholder="t('rule-pattern-label', 'Pattern')"
                :aria-label="t('rule-pattern-label', 'Pattern')"
                autocomplete="off"
                @change="commitRulePattern(rule, ($event.target as HTMLInputElement).value)"
                @keydown.enter.prevent="commitRulePattern(rule, ($event.target as HTMLInputElement).value)"
                @mousedown.stop
              />
            </label>
          </div>
          <div class="profile-url-rule__actions">
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

        <article class="profile-url-rule profile-url-rule--new">
          <label
            class="profile-url-rule__toggle"
            :title="newRule.isEnabled ? t('toggle-on', 'On') : t('toggle-off', 'Off')"
          >
            <input type="checkbox" v-model="newRule.isEnabled" />
          </label>
          <div class="profile-url-rule__fields">
            <label class="profile-url-rule__field">
              <select
                class="profile-url-rule__match-select"
                v-model="newRule.matchType"
                :aria-label="t('rule-match-label', 'Match Type')"
                @mousedown.stop
              >
                <option value="contains">{{ t("rule-match-contains", "Contains") }}</option>
                <option value="exact">{{ t("rule-match-exact", "Exact Match") }}</option>
                <option value="regex">{{ t("rule-match-regex", "Regex") }}</option>
              </select>
            </label>
            <label class="profile-url-rule__field profile-url-rule__field--pattern">
              <input
                data-testid="profile-url-new-rule-pattern"
                type="text"
                v-model="newRule.pattern"
                :placeholder="t('rule-pattern-label', 'Pattern')"
                :aria-label="t('rule-pattern-label', 'Pattern')"
                autocomplete="off"
                @blur="saveNewRule"
                @keydown.enter.prevent="saveNewRule"
              />
            </label>
          </div>
          <div class="profile-url-rule__actions">
            <button
              type="button"
              class="icon-button profile-url-rule__confirm"
              :disabled="!canAddRule"
              :title="t('profile-url-confirm', 'Confirm URL Rule')"
              :aria-label="t('profile-url-confirm', 'Confirm URL Rule')"
              @click="saveNewRule"
            >
              <IconCheck size="md" />
            </button>
          </div>
        </article>
        <div v-if="newRuleRegexError" class="settings-field__error">{{ newRuleRegexError }}</div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { isValidRegex } from "../../../../common/regex.js";
import type { ProfileRule, UrlMatchType } from "../../../../main/types.js";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import { useDesktopStore } from "../../../stores/desktop";
import { IconCheck, IconDelete } from "../../icons";

const props = defineProps<{
  profileId: string;
  isDefaultProfile: boolean;
  rules: readonly ProfileRule[];
}>();

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

const newRule = reactive<{
  matchType: UrlMatchType;
  pattern: string;
  isEnabled: boolean;
}>({
  matchType: "contains",
  pattern: "",
  isEnabled: true
});

const newRuleRegexError = computed(() => {
  if (newRule.matchType !== "regex" || !newRule.pattern.trim()) {
    return null;
  }
  return isValidRegex(newRule.pattern) ? null : t("rule-regex-invalid", "Invalid regular expression");
});

const canAddRule = computed(() => Boolean(newRule.pattern.trim()) && !newRuleRegexError.value);

watch(
  () => props.profileId,
  () => resetNewRule()
);

function isMatchType(value: string): value is UrlMatchType {
  return value === "contains" || value === "exact" || value === "regex";
}

function saveNewRule() {
  if (!canAddRule.value) {
    return;
  }
  const pattern = newRule.pattern.trim();
  store.addRule({
    name: pattern,
    matchType: newRule.matchType,
    pattern,
    profileId: props.profileId,
    isEnabled: newRule.isEnabled
  });
  resetNewRule();
}

function updateRuleMatchType(ruleId: string, value: string) {
  if (isMatchType(value)) {
    store.updateRule(ruleId, { matchType: value });
  }
}

function commitRulePattern(rule: ProfileRule, value: string) {
  const pattern = value.trim();
  if (!pattern || pattern === rule.pattern) {
    return;
  }
  store.updateRule(rule.id, { name: pattern, pattern });
}

function toggleRule(ruleId: string, isEnabled: boolean) {
  store.updateRule(ruleId, { isEnabled });
}

function onDragStart(event: DragEvent, index: number) {
  dragIndex.value = index;
  dragOverIndex.value = index;
  event.dataTransfer?.setData("text/plain", String(index));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDrop(index: number) {
  if (dragIndex.value !== null && dragIndex.value !== index) {
    store.reorderProfileRule(props.profileId, dragIndex.value, index);
  }
  resetDrag();
}

function resetDrag() {
  dragIndex.value = null;
  dragOverIndex.value = null;
}

function deleteRule(ruleId: string) {
  if (confirm(t("rule-delete-confirm", "Delete this rule?"))) {
    store.deleteRule(ruleId);
  }
}

function resetNewRule() {
  newRule.matchType = "contains";
  newRule.pattern = "";
  newRule.isEnabled = true;
}
</script>
