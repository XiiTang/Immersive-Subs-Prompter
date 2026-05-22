<template>
  <section class="ui-group">
    <header class="ui-group__header">
      <h3 class="ui-group__title">{{ t("subtitle-colors-group", "Color Scheme") }}</h3>
    </header>
    <div class="settings-color-grid">
      <div v-for="swatch in swatches" :key="swatch.settingKey" class="color-swatch-item">
        <label class="color-swatch-preview">
          <input
            type="color"
            :value="swatch.value"
            class="sr-only-input"
            @input="onColorInput(swatch.settingKey, $event)"
          />
          <div class="color-swatch-preview__fill" :style="{ backgroundColor: swatch.value }"></div>
        </label>
        <div class="color-swatch-info">
          <span class="color-swatch-label">{{ swatch.label }}</span>
          <input
            type="text"
            :value="swatch.value"
            class="color-swatch-input"
            spellcheck="false"
            @input="onColorInput(swatch.settingKey, $event)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDesktopStore } from "../../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";

type ColorSettingKey =
  | "subtitlePrimaryColor"
  | "subtitleSecondaryColor"
  | "subtitleActivePrimaryColor"
  | "subtitleActiveSecondaryColor";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const swatches = computed(() => [
  {
    settingKey: "subtitlePrimaryColor" as const,
    label: t("subtitle-primary-color-label", "Primary Text"),
    value: store.editingProfileSettings.subtitlePrimaryColor
  },
  {
    settingKey: "subtitleSecondaryColor" as const,
    label: t("subtitle-secondary-color-label", "Secondary Text"),
    value: store.editingProfileSettings.subtitleSecondaryColor
  },
  {
    settingKey: "subtitleActivePrimaryColor" as const,
    label: t("subtitle-active-primary-color-label", "Active Primary"),
    value: store.editingProfileSettings.subtitleActivePrimaryColor
  },
  {
    settingKey: "subtitleActiveSecondaryColor" as const,
    label: t("subtitle-active-secondary-color-label", "Active Secondary"),
    value: store.editingProfileSettings.subtitleActiveSecondaryColor
  }
]);

function onColorInput(key: ColorSettingKey, event: Event) {
  const target = event.target as HTMLInputElement;
  store.updateProfileSetting(key, target.value);
}
</script>
