<template>
  <div class="feature-settings">
    <UiSettingRow id="feature-word-lookup-path" :label="t('feature-word-lookup-path')" control-width="wide">
      <UiInput
        :model-value="config.wordListPath"
        data-testid="feature-word-lookup-path"
        @update:model-value="update({ wordListPath: String($event) })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-word-lookup-trigger" :label="t('feature-word-lookup-trigger')" control-width="field">
      <UiSelect
        :model-value="config.modifierKey"
        :options="modifierOptions"
        @update:model-value="update({ modifierKey: $event as 'alt' | 'ctrl' | 'shift' })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-word-lookup-width" :label="t('feature-word-lookup-panel-width')" control-width="compact">
      <UiInput
        :model-value="config.panelWidth"
        type="number"
        min="260"
        max="720"
        step="1"
        @update:model-value="update({ panelWidth: Number($event) })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-word-lookup-height" :label="t('feature-word-lookup-panel-height')" control-width="compact">
      <UiInput
        :model-value="config.panelHeight"
        type="number"
        min="180"
        max="640"
        step="1"
        @update:model-value="update({ panelHeight: Number($event) })"
      />
    </UiSettingRow>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { WordLookupFeatureConfig } from "../../../main/types";
import { DEFAULT_WORD_LOOKUP_FEATURE_CONFIG } from "../../../common/wordLookupDefaults";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { UiInput, UiSelect, UiSettingRow } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const config = computed(() => store.settings?.features.wordLookup.config ?? DEFAULT_WORD_LOOKUP_FEATURE_CONFIG);
const modifierOptions = [
  { value: "alt", label: "Alt" },
  { value: "ctrl", label: "Ctrl" },
  { value: "shift", label: "Shift" }
];

function update(patch: Partial<WordLookupFeatureConfig>) {
  void store.setFeatureConfig("wordLookup", patch);
}
</script>

<style scoped>
.feature-settings {
  display: grid;
  gap: 10px;
}
</style>
