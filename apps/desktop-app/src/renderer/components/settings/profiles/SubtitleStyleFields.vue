<template>
  <div class="subtitle-style-fields">
    <UiField id="subtitle-font" :label="t('subtitle-font-label', 'Subtitle Font')">
      <UiSelect v-model="subtitleFontFamily" data-testid="subtitle-font-select" :options="subtitleFontOptions" />
    </UiField>
    <UiField id="subtitle-font-size" :label="t('subtitle-font-size-label', 'Subtitle Font Size')">
      <UiInput v-model="subtitleFontSize" type="number" min="10" max="48" step="1" />
    </UiField>
    <UiField id="subtitle-meta-auto-hide" :label="t('subtitle-meta-auto-hide-label', 'Auto-hide Timestamps & Actions')" inline>
      <UiSwitch
        v-model="subtitleAutoHideMetaRow"
        input-test-id="subtitle-meta-auto-hide-toggle"
        :label="subtitleAutoHideMetaRow ? t('toggle-on', 'On') : t('toggle-off', 'Off')"
      />
    </UiField>
    <UiField id="subtitle-autoscroll" :label="t('subtitle-autoscroll-label', 'Auto-scroll Restore Time (seconds)')">
      <UiInput v-model="subtitleAutoScrollTimeout" type="number" min="1" max="60" step="1" />
    </UiField>
    <label class="settings-field">
      <div class="settings-field__label-row">
        <span class="settings-field__label">
          {{ t("subtitle-scroll-position-label", "Subtitle Scroll Position") }}
        </span>
        <span class="settings-field__value">{{ subtitleScrollPosition }}%</span>
      </div>
      <input type="range" min="0" max="100" step="1" class="slider" v-model.number="subtitleScrollPosition" />
      <small class="settings-field__hint">
        {{
          t(
            "subtitle-scroll-position-hint",
            "Where active subtitles sit in the panel (0% top, 50% middle, 100% bottom)"
          )
        }}
      </small>
    </label>
    <label class="settings-field">
      <div class="settings-field__label-row">
        <span class="settings-field__label">
          {{ t("subtitle-primary-secondary-gap-label", "Primary to Secondary Subtitle Gap") }}
        </span>
        <span class="settings-field__value">{{ subtitlePrimarySecondaryGap }}px</span>
      </div>
      <input
        type="range"
        min="0"
        max="60"
        step="1"
        class="slider"
        v-model.number="subtitlePrimarySecondaryGap"
      />
    </label>
    <label class="settings-field">
      <div class="settings-field__label-row">
        <span class="settings-field__label">{{ t("subtitle-line-height-label", "Line Height") }}</span>
        <span class="settings-field__value">{{ subtitleLineHeight }}</span>
      </div>
      <input type="range" min="1" max="3" step="0.05" class="slider" v-model.number="subtitleLineHeight" />
    </label>
    <label class="settings-field">
      <div class="settings-field__label-row">
        <span class="settings-field__label">{{ t("subtitle-block-gap-label", "Block Gap") }}</span>
        <span class="settings-field__value">{{ subtitleBlockGap }}px</span>
      </div>
      <input type="range" min="0" max="60" step="1" class="slider" v-model.number="subtitleBlockGap" />
      <small class="settings-field__hint">
        {{ t("subtitle-block-gap-hint", "Gap between subtitle text blocks") }}
      </small>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { SUBTITLE_FONT_OPTIONS } from "../../../../common/subtitleFonts.js";
import { useDesktopStore } from "../../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import { UiField, UiInput, UiSelect, UiSwitch } from "../../ui";

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
