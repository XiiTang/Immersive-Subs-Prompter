<template>
  <section class="profile-url-rules" data-testid="profile-url-rules">
    <header class="profile-url-rules__header">
      <div class="profile-url-rules__label-row">
        <span class="settings-field__label">{{ t("profile-url-rules-label", "Applies to these URLs") }}</span>
        <span class="profile-url-rules__hint">
          {{
            isDefaultProfile
              ? t("profile-url-default-hint", "This profile is used when no URL rule matches.")
              : t(
                "profile-url-rules-hint",
                "Rules match in listed order. Profile order controls cross-profile priority."
              )
          }}
        </span>
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
            <div class="profile-url-rule__field profile-url-rule__field--pattern">
              <UiInput
                data-testid="profile-url-rule-pattern"
                type="text"
                :model-value="rule.pattern"
                :placeholder="rulePatternPlaceholder"
                :aria-label="t('rule-pattern-label', 'Pattern')"
                autocomplete="off"
                @change="commitRulePattern(rule, ($event.target as HTMLInputElement).value)"
                @keydown.enter.prevent="commitRulePattern(rule, ($event.target as HTMLInputElement).value)"
                @mousedown.stop
              />
            </div>
            <UiBadge
              class="profile-url-rule__match-badge"
              data-testid="profile-url-rule-type"
              :aria-label="t('rule-match-label', 'Rule Type')"
            >
              {{ ruleTypeLabel(rule.pattern) }}
            </UiBadge>
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
            <div class="profile-url-rule__field profile-url-rule__field--pattern">
              <UiInput
                data-testid="profile-url-new-rule-pattern"
                type="text"
                v-model="newRule.pattern"
                :placeholder="rulePatternPlaceholder"
                :aria-label="t('rule-pattern-label', 'Pattern')"
                autocomplete="off"
                @blur="saveNewRule"
                @keydown.enter.prevent="saveNewRule"
              />
            </div>
            <UiBadge class="profile-url-rule__match-badge" :aria-label="t('rule-match-label', 'Rule Type')">
              {{ ruleTypeLabel(newRule.pattern) }}
            </UiBadge>
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
        <div v-if="newRulePatternError" class="settings-field__error">{{ newRulePatternError }}</div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { parseUrlRulePattern } from "../../../../common/urlRuleMatcher.js";
import type { UrlRuleMatchType } from "../../../../common/urlRuleMatcher.js";
import type { ProfileRule } from "../../../../main/types.js";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import { useDesktopStore } from "../../../stores/desktop";
import { IconCheck, IconDelete } from "../../icons";
import { UiBadge, UiEmptyState, UiIconButton, UiInput, UiListItem, UiSwitch } from "../../ui";

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
  pattern: string;
  isEnabled: boolean;
}>({
  pattern: "",
  isEnabled: true
});

const rulePatternPlaceholder = computed(() =>
  t("rule-pattern-smart-placeholder", "youtube.com, *.site.com/path/*, =full URL, re:pattern")
);
const ruleTypeLabels = computed<Record<UrlRuleMatchType, string>>(() => ({
  domain: t("rule-match-domain", "Domain"),
  glob: t("rule-match-glob", "Glob"),
  exact: t("rule-match-exact", "Exact"),
  regex: t("rule-match-regex", "Regex"),
  contains: t("rule-match-contains", "Contains")
}));
const newRulePatternError = computed(() => patternErrorMessage(newRule.pattern));

const canAddRule = computed(() => Boolean(newRule.pattern.trim()) && !newRulePatternError.value);

watch(
  () => props.profileId,
  () => resetNewRule()
);

function saveNewRule() {
  if (!canAddRule.value) {
    return;
  }
  const pattern = newRule.pattern.trim();
  store.addRule({
    name: pattern,
    pattern,
    profileId: props.profileId,
    isEnabled: newRule.isEnabled
  });
  resetNewRule();
}

function commitRulePattern(rule: ProfileRule, value: string) {
  const pattern = value.trim();
  if (!pattern || pattern === rule.pattern || patternErrorMessage(pattern)) {
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
  newRule.pattern = "";
  newRule.isEnabled = true;
}

function ruleTypeLabel(pattern: string) {
  const { type } = parseUrlRulePattern(pattern);
  return ruleTypeLabels.value[type];
}

function patternErrorMessage(pattern: string) {
  const parsed = parseUrlRulePattern(pattern);
  if (parsed.error === "invalid-regex") {
    return t("rule-regex-invalid", "Invalid regular expression");
  }
  return null;
}
</script>
