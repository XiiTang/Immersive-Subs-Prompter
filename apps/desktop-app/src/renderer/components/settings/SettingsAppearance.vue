<template>
  <UiSection :title="t('section-appearance', 'Appearance')">
    <UiField id="appearance-theme" :label="t('appearance-theme-label', 'Theme')">
      <div class="ui-segmented" role="radiogroup" :aria-label="t('appearance-theme-label', 'Theme')">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          type="button"
          class="ui-segmented__item"
          :class="{ 'is-selected': appearanceTheme === option.value }"
          role="radio"
          :aria-checked="appearanceTheme === option.value"
          @click="appearanceTheme = option.value"
        >
          {{ option.label }}
        </button>
      </div>
    </UiField>
  </UiSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { AppearanceTheme } from "../../../main/types";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { UiField, UiSection } from "../ui";

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
