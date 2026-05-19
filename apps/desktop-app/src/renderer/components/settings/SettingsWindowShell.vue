<template>
  <section class="settings-window-shell settings-window-shell--document" data-testid="settings-shell">
    <header class="settings-window-shell__header">{{ settingsTitle }}</header>
    <div class="settings-window-shell__body">
      <SettingsNav
        :sections="allSections"
        :current-section="currentSection"
        :nav-aria-label="settingsNavAriaLabel"
        @select="scrollToSection"
      />
      <main
        ref="contentRef"
        class="settings-window-shell__content"
        data-testid="settings-content"
        data-scroll-mode="document"
      >
        <div class="settings-document">
          <section
            v-for="section in allSections"
            :id="section.anchorId"
            :key="section.id"
            :data-testid="section.anchorId"
            class="settings-document__section"
          >
            <component :is="resolveComponent(section.id)" />
          </section>
        </div>
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import SettingsGlobal from "./SettingsGlobal.vue";
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
const contentRef = ref<HTMLElement | null>(null);
let sectionObserver: IntersectionObserver | null = null;

const hostComponentMap: Record<string, unknown> = {
  general: SettingsGlobal,
  profiles: SettingsProfiles,
  cache: SettingsCache,
  plugins: SettingsPlugins
};

function resolveComponent(sectionId: string): unknown {
  return hostComponentMap[sectionId] ?? resolvePluginSettingsComponent(sectionId);
}

function sectionIdFromAnchor(anchorId: string): SettingsSectionId {
  const pluginSection = store.pluginCatalog
    .find((plugin) => plugin.enabled && plugin.settings?.some((section) => section.anchorId === anchorId))
    ?.settings?.find((section) => section.anchorId === anchorId);
  return (pluginSection?.id ?? anchorId.replace("settings-section-", "")) as SettingsSectionId;
}

function scrollToSection(id: SettingsSectionId) {
  const section = allSections.value.find((s) => s.id === id);
  if (!section) return;
  const target = document.getElementById(section.anchorId);
  if (!target) return;

  currentSection.value = id;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

onMounted(() => {
  if (typeof IntersectionObserver === "undefined" || !contentRef.value) {
    return;
  }

  sectionObserver = new IntersectionObserver(
    (entries) => {
      const visibleEntry = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];

      if (!visibleEntry?.target.id) {
        return;
      }

      currentSection.value = sectionIdFromAnchor(visibleEntry.target.id);
    },
    {
      root: contentRef.value,
      threshold: [0.2, 0.35, 0.5, 0.7]
    }
  );

  watch(
    () => allSections.value.map((section) => section.anchorId),
    async () => {
      if (!sectionObserver) return;
      sectionObserver.disconnect();
      await nextTick();
      for (const section of allSections.value) {
        const element = document.getElementById(section.anchorId);
        if (element) {
          sectionObserver.observe(element);
        }
      }
    },
    { immediate: true, flush: "post" }
  );
});

onBeforeUnmount(() => {
  sectionObserver?.disconnect();
});
</script>
