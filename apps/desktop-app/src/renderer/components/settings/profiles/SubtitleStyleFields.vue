<template>
  <div class="subtitle-style-fields" data-testid="subtitle-style-compact-panel">
    <div class="subtitle-style-fields__typography">
      <div class="subtitle-style-fields__typography-row" data-testid="primary-subtitle-typography-row">
        <UiField
          id="primary-subtitle-font"
          class="subtitle-style-fields__field subtitle-style-fields__field--font"
          :label="t('primary-subtitle-font-label', 'Primary Font')"
        >
          <UiSelect
            v-model="primarySubtitleFontFamily"
            data-testid="primary-subtitle-font-select"
            :options="subtitleFontOptions"
          />
        </UiField>
        <UiField
          id="primary-subtitle-font-size"
          class="subtitle-style-fields__field subtitle-style-fields__field--slider"
          :label="t('primary-subtitle-font-size-label', 'Primary Size')"
          :value="`${primarySubtitleFontSize}px`"
        >
          <UiSlider
            v-model="primarySubtitleFontSize"
            :min="3"
            :max="96"
            :step="1"
            :label="t('primary-subtitle-font-size-label', 'Primary Size')"
            @change="flushDeferredProfileSettings"
          />
        </UiField>
      </div>

      <div class="subtitle-style-fields__typography-row" data-testid="secondary-subtitle-typography-row">
        <UiField
          id="secondary-subtitle-font"
          class="subtitle-style-fields__field subtitle-style-fields__field--font"
          :label="t('secondary-subtitle-font-label', 'Secondary Font')"
        >
          <UiSelect
            v-model="secondarySubtitleFontFamily"
            data-testid="secondary-subtitle-font-select"
            :options="subtitleFontOptions"
          />
        </UiField>
        <UiField
          id="secondary-subtitle-font-size"
          class="subtitle-style-fields__field subtitle-style-fields__field--slider"
          :label="t('secondary-subtitle-font-size-label', 'Secondary Size')"
          :value="`${secondarySubtitleFontSize}px`"
        >
          <UiSlider
            v-model="secondarySubtitleFontSize"
            :min="3"
            :max="96"
            :step="1"
            :label="t('secondary-subtitle-font-size-label', 'Secondary Size')"
            @change="flushDeferredProfileSettings"
          />
        </UiField>
      </div>
    </div>

    <div class="subtitle-style-fields__colors">
      <ColorSchemeGrid />
    </div>

    <div class="subtitle-style-fields__layout-grid" data-testid="subtitle-style-layout-grid">
      <UiField
        id="subtitle-scroll-position"
        class="subtitle-style-fields__field subtitle-style-fields__field--slider"
        :label="t('subtitle-scroll-position-label', 'Scroll Position')"
        :value="`${subtitleScrollPosition}%`"
      >
        <UiSlider
          v-model="subtitleScrollPosition"
          :min="0"
          :max="100"
          :step="1"
          :label="t('subtitle-scroll-position-label', 'Scroll Position')"
          @change="flushDeferredProfileSettings"
        />
      </UiField>
      <UiField
        id="subtitle-primary-secondary-gap"
        class="subtitle-style-fields__field subtitle-style-fields__field--slider"
        :label="t('subtitle-primary-secondary-gap-label', 'Subtitle Gap')"
        :value="`${subtitlePrimarySecondaryGap}px`"
      >
        <UiSlider
          v-model="subtitlePrimarySecondaryGap"
          :min="0"
          :max="60"
          :step="1"
          :label="t('subtitle-primary-secondary-gap-label', 'Subtitle Gap')"
          @change="flushDeferredProfileSettings"
        />
      </UiField>
      <UiField
        id="subtitle-line-height"
        class="subtitle-style-fields__field subtitle-style-fields__field--slider"
        :label="t('subtitle-line-height-label', 'Line Height')"
        :value="String(subtitleLineHeight)"
      >
        <UiSlider
          v-model="subtitleLineHeight"
          :min="1"
          :max="3"
          :step="0.05"
          :label="t('subtitle-line-height-label', 'Line Height')"
          @change="flushDeferredProfileSettings"
        />
      </UiField>
      <UiField
        id="subtitle-block-gap"
        class="subtitle-style-fields__field subtitle-style-fields__field--slider"
        :label="t('subtitle-block-gap-label', 'Block Gap')"
        :value="`${subtitleBlockGap}px`"
      >
        <UiSlider
          v-model="subtitleBlockGap"
          :min="0"
          :max="60"
          :step="1"
          :label="t('subtitle-block-gap-label', 'Block Gap')"
          @change="flushDeferredProfileSettings"
        />
      </UiField>
    </div>

    <div class="subtitle-style-fields__behavior-row" data-testid="subtitle-style-behavior-row">
      <UiField
        id="subtitle-meta-auto-hide"
        class="subtitle-style-fields__field subtitle-style-fields__field--behavior"
        :label="t('subtitle-meta-auto-hide-label', 'Auto-hide Controls')"
        inline
      >
        <UiSwitch
          v-model="subtitleAutoHideMetaRow"
          input-test-id="subtitle-meta-auto-hide-toggle"
          :label="subtitleAutoHideMetaRow ? t('toggle-on', 'On') : t('toggle-off', 'Off')"
          :show-label="false"
        />
      </UiField>
      <UiField
        id="subtitle-autoscroll"
        class="subtitle-style-fields__field subtitle-style-fields__field--behavior"
        :label="t('subtitle-autoscroll-label', 'Restore Delay (s)')"
        inline
      >
        <UiInput
          v-model="subtitleAutoScrollTimeout"
          class="subtitle-style-fields__autoscroll-input"
          type="number"
          min="1"
          max="60"
          step="1"
        />
      </UiField>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ProfileSettings } from "../../../../main/types";
import { SUBTITLE_FONT_OPTIONS } from "../../../../common/subtitleFonts.js";
import { useDesktopStore } from "../../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import { UiField, UiInput, UiSelect, UiSlider, UiSwitch } from "../../ui";
import ColorSchemeGrid from "./ColorSchemeGrid.vue";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const subtitleFontOptions = SUBTITLE_FONT_OPTIONS.map((option) => ({
  ...option,
  fontFamilyPreview: option.value
}));

function updateDeferredProfileSetting<Key extends keyof ProfileSettings>(
  key: Key,
  value: ProfileSettings[Key]
) {
  store.updateProfileSetting(key, value, { persist: "deferred" });
}

function flushDeferredProfileSettings() {
  void store.flushDeferredSettingsPersistence();
}

const primarySubtitleFontFamily = computed({
  get: () => store.editingProfileSettings.primarySubtitleFontFamily,
  set: (value: string) => store.updateProfileSetting("primarySubtitleFontFamily", value)
});

const primarySubtitleFontSize = computed({
  get: () => store.editingProfileSettings.primarySubtitleFontSize,
  set: (value: number) => updateDeferredProfileSetting("primarySubtitleFontSize", value)
});

const secondarySubtitleFontFamily = computed({
  get: () => store.editingProfileSettings.secondarySubtitleFontFamily,
  set: (value: string) => store.updateProfileSetting("secondarySubtitleFontFamily", value)
});

const secondarySubtitleFontSize = computed({
  get: () => store.editingProfileSettings.secondarySubtitleFontSize,
  set: (value: number) => updateDeferredProfileSetting("secondarySubtitleFontSize", value)
});

const subtitleAutoHideMetaRow = computed({
  get: () => store.editingProfileSettings.subtitleAutoHideMetaRow,
  set: (value: boolean) => store.updateProfileSetting("subtitleAutoHideMetaRow", value)
});

const subtitleAutoScrollTimeout = computed({
  get: () => store.editingProfileSettings.subtitleAutoScrollTimeout,
  set: (value: number) => store.updateProfileSetting("subtitleAutoScrollTimeout", value)
});

const subtitleScrollPosition = computed({
  get: () => store.editingProfileSettings.subtitleScrollPosition,
  set: (value: number) => updateDeferredProfileSetting("subtitleScrollPosition", value)
});

const subtitlePrimarySecondaryGap = computed({
  get: () => store.editingProfileSettings.subtitlePrimarySecondaryGap,
  set: (value: number) => updateDeferredProfileSetting("subtitlePrimarySecondaryGap", value)
});

const subtitleLineHeight = computed({
  get: () => store.editingProfileSettings.subtitleLineHeight,
  set: (value: number) => updateDeferredProfileSetting("subtitleLineHeight", value)
});

const subtitleBlockGap = computed({
  get: () => store.editingProfileSettings.subtitleBlockGap,
  set: (value: number) => updateDeferredProfileSetting("subtitleBlockGap", value)
});
</script>
