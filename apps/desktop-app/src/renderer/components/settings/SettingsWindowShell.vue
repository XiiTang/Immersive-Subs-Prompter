<template>
  <section class="settings-window-shell" data-testid="settings-shell">
    <header class="settings-window-shell__header">{{ settingsTitle }}</header>
    <div class="settings-window-shell__body">
      <SettingsNav
        :sections="allSections"
        :current-section="currentSection"
        :nav-aria-label="settingsNavAriaLabel"
        @select="selectSection"
      />
      <main
        class="settings-window-shell__content"
        data-testid="settings-content"
      >
        <component :is="activeComponent" :key="currentSection" />
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import SettingsFeatures from "./SettingsFeatures.vue";
import SettingsGlobal from "./SettingsGlobal.vue";
import SettingsProfiles from "./SettingsProfiles.vue";
import SettingsNav from "./SettingsNav.vue";
import JellyfinEmbyFeatureSettings from "./JellyfinEmbyFeatureSettings.vue";
import TranscriptionFeatureSettings from "./TranscriptionFeatureSettings.vue";
import WordLookupFeatureSettings from "./WordLookupFeatureSettings.vue";
import { buildSettingsSections, type SettingsSectionId } from "./settingsSections";
import { DEFAULT_LANGUAGE, normalizeLanguage, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";

const store = useDesktopStore();
const language = computed(() => normalizeLanguage(store.settings?.global.language ?? DEFAULT_LANGUAGE));
const { t } = useI18n(language);
const settingsTitle = computed(() => t("settings-title"));
const settingsNavAriaLabel = computed(() => t("settings-nav-aria-label"));
const allSections = computed(() => buildSettingsSections(language.value, store.settings?.features));
const currentSection = ref<SettingsSectionId>("general");

const hostComponentMap: Record<string, unknown> = {
  general: SettingsGlobal,
  profiles: SettingsProfiles,
  features: SettingsFeatures,
  "feature-wordLookup": WordLookupFeatureSettings,
  "feature-transcription": TranscriptionFeatureSettings,
  "feature-jellyfinEmby": JellyfinEmbyFeatureSettings
};

const activeComponent = computed(() => hostComponentMap[currentSection.value] ?? SettingsGlobal);

function selectSection(id: SettingsSectionId) {
  currentSection.value = id;
}

watch(
  () => allSections.value.map((section) => section.id),
  (ids) => {
    if (!ids.includes(currentSection.value)) {
      currentSection.value = currentSection.value.startsWith("feature-") && ids.includes("features")
        ? "features"
        : ((ids[0] ?? "general") as SettingsSectionId);
    }
  },
  { immediate: true }
);
</script>
