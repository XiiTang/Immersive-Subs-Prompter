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

    <UiBadge v-if="isDefaultProfile">{{ t("profile-url-default-summary", "Fallback") }}</UiBadge>

    <template v-else>
      <div class="profile-url-rules__list ui-list">
        <UiListItem
          v-for="(rule, index) in rules"
          :key="rule.id"
          as="article"
          class="profile-url-rule"
          :class="{ 'is-drag-over': dragOverIndex === index }"
          :disabled="!rule.isEnabled"
          draggable="true"
          @dragstart="onDragStart($event, index)"
          @dragover.prevent="dragOverIndex = index"
          @dragleave="dragOverIndex = null"
          @drop.prevent="onDrop(index)"
          @dragend="resetDrag"
        >
          <UiSwitch
            class="profile-url-rule__toggle"
            :model-value="rule.isEnabled"
            :show-label="false"
            :label="rule.isEnabled ? t('toggle-on', 'On') : t('toggle-off', 'Off')"
            @update:model-value="toggleRule(rule.id, $event)"
          />
          <div class="profile-url-rule__fields">
            <label class="profile-url-rule__field">
              <UiSelect
                class="profile-url-rule__match-select"
                data-testid="profile-url-rule-match-type"
                :model-value="rule.matchType"
                :options="matchTypeOptions"
                :aria-label="t('rule-match-label', 'Match Type')"
                @update:model-value="updateRuleMatchType(rule.id, $event)"
                @mousedown.stop
              />
            </label>
            <label class="profile-url-rule__field profile-url-rule__field--pattern">
              <UiInput
                data-testid="profile-url-rule-pattern"
                type="text"
                :model-value="rule.pattern"
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
            <UiIconButton variant="danger" :label="t('rule-action-delete', 'Delete')" @click="deleteRule(rule.id)">
              <IconDelete size="md" />
            </UiIconButton>
          </div>
        </UiListItem>
        <UiEmptyState v-if="!rules.length" :message="t('profile-url-empty', 'No URL rules')" />

        <UiListItem as="article" class="profile-url-rule profile-url-rule--new">
          <UiSwitch
            v-model="newRule.isEnabled"
            class="profile-url-rule__toggle"
            :show-label="false"
            :label="newRule.isEnabled ? t('toggle-on', 'On') : t('toggle-off', 'Off')"
          />
          <div class="profile-url-rule__fields">
            <label class="profile-url-rule__field">
              <UiSelect
                class="profile-url-rule__match-select"
                v-model="newRule.matchType"
                :options="matchTypeOptions"
                :aria-label="t('rule-match-label', 'Match Type')"
                @mousedown.stop
              />
            </label>
            <label class="profile-url-rule__field profile-url-rule__field--pattern">
              <UiInput
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
            <UiIconButton
              :disabled="!canAddRule"
              class="profile-url-rule__confirm"
              :label="t('profile-url-confirm', 'Confirm URL Rule')"
              @click="saveNewRule"
            >
              <IconCheck size="md" />
            </UiIconButton>
          </div>
        </UiListItem>
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
import { UiBadge, UiEmptyState, UiIconButton, UiInput, UiListItem, UiSelect, UiSwitch } from "../../ui";

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

const matchTypeOptions = computed(() => [
  { value: "contains", label: t("rule-match-contains", "Contains") },
  { value: "exact", label: t("rule-match-exact", "Exact Match") },
  { value: "regex", label: t("rule-match-regex", "Regex") }
]);

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
