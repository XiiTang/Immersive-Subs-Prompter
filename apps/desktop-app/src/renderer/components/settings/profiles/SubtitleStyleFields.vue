<template>
  <div class="subtitle-style-fields">
    <label class="settings-field">
      <span class="settings-field__label">{{ t("subtitle-font-label", "Subtitle Font") }}</span>
      <select v-model="subtitleFontFamily" data-testid="subtitle-font-select">
        <option v-for="fontOption in subtitleFontOptions" :key="fontOption.value" :value="fontOption.value">
          {{ fontOption.label }}
        </option>
      </select>
    </label>
    <label class="settings-field">
      <span class="settings-field__label">{{ t("subtitle-font-size-label", "Subtitle Font Size") }}</span>
      <input type="number" min="10" max="48" step="1" v-model.number="subtitleFontSize" />
    </label>
    <div class="settings-field settings-field--inline">
      <span class="settings-field__label">
        {{ t("subtitle-meta-auto-hide-label", "Auto-hide Timestamps & Actions") }}
      </span>
      <label class="toggle">
        <input
          type="checkbox"
          v-model="subtitleAutoHideMetaRow"
          data-testid="subtitle-meta-auto-hide-toggle"
        />
        <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
      </label>
    </div>
    <label class="settings-field">
      <span class="settings-field__label">
        {{ t("subtitle-autoscroll-label", "Auto-scroll Restore Time (seconds)") }}
      </span>
      <input type="number" min="1" max="60" step="1" v-model.number="subtitleAutoScrollTimeout" />
    </label>
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
