<template>
  <UiSection :title="t('section-appearance', 'Appearance')">
    <UiField id="appearance-theme" :label="t('appearance-theme-label', 'Theme')">
      <UiSegmentedControl
        v-model="appearanceTheme"
        :label="t('appearance-theme-label', 'Theme')"
        :options="themeOptions"
      />
    </UiField>
  </UiSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AppearanceTheme } from "../../../main/types";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { UiField, UiSection, UiSegmentedControl } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const themeOptions = computed<Array<{ value: AppearanceTheme; label: string }>>(() => [
  { value: "system", label: t("appearance-theme-system", "System") },
  { value: "light", label: t("appearance-theme-light", "Light") },
  { value: "dark", label: t("appearance-theme-dark", "Dark") }
]);

const appearanceTheme = computed<AppearanceTheme>({
  get: () => store.settings?.global.appearance.theme ?? "system",
  set: (theme) => {
    const current = store.settings?.global.appearance ?? { theme: "system" };
    store.updateGlobalSetting("appearance", { ...current, theme });
  }
});
</script>
