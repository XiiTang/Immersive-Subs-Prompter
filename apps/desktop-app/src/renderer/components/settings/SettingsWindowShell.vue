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
        data-scroll-mode="section"
      >
        <component :is="activeComponent" :key="currentSection" />
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import SettingsGlobal from "./SettingsGlobal.vue";
import SettingsAppearance from "./SettingsAppearance.vue";
import SettingsProfiles from "./SettingsProfiles.vue";
import SettingsCache from "./SettingsCache.vue";
import SettingsPlugins from "./SettingsPlugins.vue";
import SettingsNav from "./SettingsNav.vue";
import { buildSettingsSections, type SettingsSectionId } from "./settingsSections";
import { DEFAULT_LANGUAGE, normalizeLanguage, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { resolvePluginSettingsComponent } from "../../plugins/pluginSettingsRegistry";

const store = useDesktopStore();
const language = computed(() => normalizeLanguage(store.settings?.global.language ?? DEFAULT_LANGUAGE));
const { t } = useI18n(language);
const settingsTitle = computed(() => t("settings-title", "Settings"));
const settingsNavAriaLabel = computed(() => t("settings-nav-aria-label", "Settings sections"));

const hostSections = computed(() => buildSettingsSections(language.value));

const pluginSections = computed(() => {
  return store.pluginCatalog
    .filter((p) => p.enabled)
    .flatMap((plugin) =>
      (plugin.settings ?? []).map((section) => ({
        id: section.id,
        label: section.title,
        anchorId: section.anchorId
      }))
    );
});

const allSections = computed(() => [...hostSections.value, ...pluginSections.value]);

const currentSection = ref<SettingsSectionId>("general");

const hostComponentMap: Record<string, unknown> = {
  general: SettingsGlobal,
  appearance: SettingsAppearance,
  profiles: SettingsProfiles,
  cache: SettingsCache,
  plugins: SettingsPlugins
};

function resolveComponent(sectionId: string): unknown {
  return hostComponentMap[sectionId] ?? resolvePluginSettingsComponent(sectionId);
}

const activeComponent = computed(() => resolveComponent(currentSection.value));

function selectSection(id: SettingsSectionId) {
  currentSection.value = id;
}

watch(
  () => allSections.value.map((section) => section.id),
  (ids) => {
    if (!ids.includes(currentSection.value)) {
      currentSection.value = (ids[0] ?? "general") as SettingsSectionId;
    }
  },
  { immediate: true }
);
</script>
