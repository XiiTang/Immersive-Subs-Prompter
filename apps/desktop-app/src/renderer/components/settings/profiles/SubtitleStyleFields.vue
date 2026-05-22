<template>
  <div class="subtitle-style-fields">
    <div class="subtitle-style-fields__row">
      <UiField id="subtitle-font" :label="t('subtitle-font-label', 'Subtitle Font')">
        <UiSelect v-model="subtitleFontFamily" data-testid="subtitle-font-select" :options="subtitleFontOptions" />
      </UiField>
      <UiField id="subtitle-font-size" :label="t('subtitle-font-size-label', 'Subtitle Font Size')">
        <UiInput v-model="subtitleFontSize" type="number" min="10" max="48" step="1" />
      </UiField>
    </div>
    <div class="subtitle-style-fields__row">
      <UiField
        id="subtitle-meta-auto-hide"
        :label="t('subtitle-meta-auto-hide-label', 'Auto-hide Timestamps & Action Bar')"
        inline
      >
        <UiSwitch
          v-model="subtitleAutoHideMetaRow"
          input-test-id="subtitle-meta-auto-hide-toggle"
          :label="subtitleAutoHideMetaRow ? t('toggle-on', 'On') : t('toggle-off', 'Off')"
        />
      </UiField>
      <UiField id="subtitle-autoscroll" :label="t('subtitle-autoscroll-label', 'Auto-scroll Restore Time (seconds)')">
        <UiInput v-model="subtitleAutoScrollTimeout" type="number" min="1" max="60" step="1" />
      </UiField>
    </div>
    <UiField
      id="subtitle-scroll-position"
      :label="t('subtitle-scroll-position-label', 'Subtitle Scroll Position')"
      :value="`${subtitleScrollPosition}%`"
      :hint="t('subtitle-scroll-position-hint', 'Where active subtitles sit in the panel (0% top, 50% middle, 100% bottom)')"
    >
      <UiSlider
        v-model="subtitleScrollPosition"
        :min="0"
        :max="100"
        :step="1"
        :label="t('subtitle-scroll-position-label', 'Subtitle Scroll Position')"
      />
    </UiField>
    <UiField
      id="subtitle-primary-secondary-gap"
      :label="t('subtitle-primary-secondary-gap-label', 'Primary to Secondary Subtitle Gap')"
      :value="`${subtitlePrimarySecondaryGap}px`"
    >
      <UiSlider
        v-model="subtitlePrimarySecondaryGap"
        :min="0"
        :max="60"
        :step="1"
        :label="t('subtitle-primary-secondary-gap-label', 'Primary to Secondary Subtitle Gap')"
      />
    </UiField>
    <UiField
      id="subtitle-line-height"
      :label="t('subtitle-line-height-label', 'Line Height')"
      :value="String(subtitleLineHeight)"
    >
      <UiSlider
        v-model="subtitleLineHeight"
        :min="1"
        :max="3"
        :step="0.05"
        :label="t('subtitle-line-height-label', 'Line Height')"
      />
    </UiField>
    <UiField
      id="subtitle-block-gap"
      :label="t('subtitle-block-gap-label', 'Block Gap')"
      :value="`${subtitleBlockGap}px`"
      :hint="t('subtitle-block-gap-hint', 'Gap between subtitle text blocks')"
    >
      <UiSlider
        v-model="subtitleBlockGap"
        :min="0"
        :max="60"
        :step="1"
        :label="t('subtitle-block-gap-label', 'Block Gap')"
      />
    </UiField>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { SUBTITLE_FONT_OPTIONS } from "../../../../common/subtitleFonts.js";
import { useDesktopStore } from "../../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import { UiField, UiInput, UiSelect, UiSlider, UiSwitch } from "../../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const subtitleFontOptions = SUBTITLE_FONT_OPTIONS;

const subtitleFontFamily = computed({
  get: () => store.editingProfileSettings.subtitleFontFamily,
  set: (value: string) => store.updateProfileSetting("subtitleFontFamily", value)
});

const subtitleFontSize = computed({
  get: () => store.editingProfileSettings.subtitleFontSize,
  set: (value: number) => store.updateProfileSetting("subtitleFontSize", value)
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
  set: (value: number) => store.updateProfileSetting("subtitleScrollPosition", value)
});

const subtitlePrimarySecondaryGap = computed({
  get: () => store.editingProfileSettings.subtitlePrimarySecondaryGap,
  set: (value: number) => store.updateProfileSetting("subtitlePrimarySecondaryGap", value)
});

const subtitleLineHeight = computed({
  get: () => store.editingProfileSettings.subtitleLineHeight,
  set: (value: number) => store.updateProfileSetting("subtitleLineHeight", value)
});

const subtitleBlockGap = computed({
  get: () => store.editingProfileSettings.subtitleBlockGap,
  set: (value: number) => store.updateProfileSetting("subtitleBlockGap", value)
});
</script>
