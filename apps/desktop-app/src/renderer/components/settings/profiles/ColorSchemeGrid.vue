<template>
  <div class="settings-color-grid" data-testid="subtitle-color-grid">
    <div v-for="swatch in swatches" :key="swatch.settingKey" class="color-swatch-item">
      <div class="color-swatch-info">
        <UiColorInput
          :model-value="swatch.value"
          class="color-swatch-input"
          :label="swatch.label"
          @update:model-value="onColorInput(swatch.settingKey, $event)"
          @change="flushColorInput"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDesktopStore } from "../../../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../../../i18n";
import { UiColorInput } from "../../ui";

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
    label: t("subtitle-primary-color-label"),
    value: store.editingProfileSettings.subtitlePrimaryColor
  },
  {
    settingKey: "subtitleSecondaryColor" as const,
    label: t("subtitle-secondary-color-label"),
    value: store.editingProfileSettings.subtitleSecondaryColor
  },
  {
    settingKey: "subtitleActivePrimaryColor" as const,
    label: t("subtitle-active-primary-color-label"),
    value: store.editingProfileSettings.subtitleActivePrimaryColor
  },
  {
    settingKey: "subtitleActiveSecondaryColor" as const,
    label: t("subtitle-active-secondary-color-label"),
    value: store.editingProfileSettings.subtitleActiveSecondaryColor
  }
]);

function onColorInput(key: ColorSettingKey, value: string) {
  store.updateProfileSetting(key, value, { persist: "deferred" });
}

function flushColorInput() {
  void store.flushDeferredSettingsPersistence();
}
</script>
