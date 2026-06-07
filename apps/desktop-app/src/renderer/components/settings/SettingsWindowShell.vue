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
        <component :is="activeComponent" :key="currentSection" :section-id="currentSection" />
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import SettingsGlobal from "./SettingsGlobal.vue";
import SettingsProfiles from "./SettingsProfiles.vue";
import SettingsPlugins from "./SettingsPlugins.vue";
import SettingsNav from "./SettingsNav.vue";
import { buildSettingsSections, type SettingsNavIconKey, type SettingsSectionId } from "./settingsSections";
import { DEFAULT_LANGUAGE, normalizeLanguage, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import PluginSettingsSchema from "./PluginSettingsSchema.vue";
import { encodePluginSettingsSectionKey } from "./pluginSettingsSectionKey";

const store = useDesktopStore();
const language = computed(() => normalizeLanguage(store.settings?.global.language ?? DEFAULT_LANGUAGE));
const { t } = useI18n(language);
const settingsTitle = computed(() => t("settings-title"));
const settingsNavAriaLabel = computed(() => t("settings-nav-aria-label"));

const hostSections = computed(() => buildSettingsSections(language.value));

const pluginSections = computed(() => {
  return store.pluginCatalog
    .filter((p) => p.enabled)
    .flatMap((plugin) =>
      (plugin.settings ?? []).map((section) => ({
        id: encodePluginSettingsSectionKey(plugin.pluginKey, section.id),
        label: section.title,
        icon: pluginSettingsIcon(plugin.id, section.id)
      }))
    );
});

const allSections = computed(() => [...hostSections.value, ...pluginSections.value]);

const currentSection = ref<SettingsSectionId>("general");

const hostComponentMap: Record<string, unknown> = {
  general: SettingsGlobal,
  profiles: SettingsProfiles,
  plugins: SettingsPlugins
};

function resolveComponent(sectionId: string): unknown {
  return hostComponentMap[sectionId] ?? PluginSettingsSchema;
}

const activeComponent = computed(() => resolveComponent(currentSection.value));

function selectSection(id: SettingsSectionId) {
  currentSection.value = id;
}

function pluginSettingsIcon(pluginId: string, sectionId: string): SettingsNavIconKey | undefined {
  const identity = `${pluginId} ${sectionId}`;
  if (identity.includes("transcription")) {
    return "transcription";
  }
  if (identity.includes("word-lookup") || identity.includes("lookup")) {
    return "wordLookup";
  }
  if (identity.includes("jellyfin") || identity.includes("emby") || identity.includes("media")) {
    return "mediaServer";
  }
  return undefined;
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
