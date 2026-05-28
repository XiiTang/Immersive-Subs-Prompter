<template>
  <section class="profile-url-rules" data-testid="profile-url-rules">
    <header v-if="isDefaultProfile" class="profile-url-rules__header">
      <div class="profile-url-rules__label-row">
        <span class="settings-field__label">{{ t("profile-url-rules-label", "URL Rules") }}</span>
        <span class="profile-url-rules__hint">
          {{ t("profile-url-default-hint", "Fallback when no URL rule matches.") }}
        </span>
      </div>
    </header>
    <PillListEditor
      v-else
      class="profile-url-rules__editor"
      :label="t('profile-url-rules-label', 'URL Rules')"
      :hint="urlRulesHint"
      :items="pillItems"
      :draft-value="draftPattern"
      :placeholder="rulePatternPlaceholder"
      :remove-label="t('rule-action-delete', 'Delete')"
      :error="draftPatternError"
      :sortable="true"
      draft-test-id="profile-url-rule-draft"
      display-test-id-prefix="profile-url-rule-display"
      remove-test-id-prefix="profile-url-rule-remove"
      @update:draft-value="setDraftPattern"
      @add-draft="saveNewRule"
      @remove="deleteRule"
      @reorder="(fromIndex, toIndex) => store.reorderProfileRule(profileId, fromIndex, toIndex)"
    />
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { parseUrlRulePattern, type UrlRuleMatchType } from "@immersive-subs/contracts";
import type { ProfileRule } from "../../../../main/types.js";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import { useDesktopStore } from "../../../stores/desktop";
import PillListEditor from "../PillListEditor.vue";
import type { PillListEditorItem } from "../pillListEditorTypes";

const props = defineProps<{
  profileId: string;
  isDefaultProfile: boolean;
  rules: readonly ProfileRule[];
}>();

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const draftPattern = ref("");

const rulePatternPlaceholder = computed(() =>
  t("rule-pattern-smart-placeholder", "youtube.com, *.site.com/path/*, =full URL, re:pattern")
);
const urlRulesHint = computed(() =>
  t("profile-url-rules-hint", "Match top to bottom; profile order breaks ties.")
);
const ruleTypeLabels = computed<Record<UrlRuleMatchType, string>>(() => ({
  domain: t("rule-match-domain", "Domain"),
  glob: t("rule-match-glob", "Glob"),
  exact: t("rule-match-exact", "Exact"),
  regex: t("rule-match-regex", "Regex"),
  contains: t("rule-match-contains", "Contains")
}));
const draftPatternError = computed(() => patternErrorMessage(draftPattern.value));

const pillItems = computed<PillListEditorItem[]>(() =>
  props.rules.map((rule) => ({
    id: rule.id,
    label: rule.pattern,
    title: `${rule.pattern} (${ruleTypeLabel(rule.pattern)})`
  }))
);

watch(
  () => props.profileId,
  () => resetDraftPattern()
);

function saveNewRule() {
  if (!draftPattern.value.trim() || draftPatternError.value) {
    return;
  }
  const pattern = draftPattern.value.trim();
  store.addRule({
    name: pattern,
    pattern,
    profileId: props.profileId
  });
  resetDraftPattern();
}

function setDraftPattern(value: string | number) {
  draftPattern.value = String(value);
}

function deleteRule(ruleId: string) {
  store.deleteRule(ruleId);
}

function resetDraftPattern() {
  draftPattern.value = "";
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
