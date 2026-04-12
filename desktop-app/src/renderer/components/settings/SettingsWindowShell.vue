<template>
  <section class="settings-window-shell settings-window-shell--document" data-testid="settings-shell">
    <header class="settings-window-shell__header">Settings</header>
    <div class="settings-window-shell__body">
      <SettingsNav :sections="sections" :current-section="currentSection" @select="scrollToSection" />
      <main
        ref="contentRef"
        class="settings-window-shell__content"
        data-testid="settings-content"
        data-scroll-mode="document"
      >
        <div class="settings-document">
          <header class="settings-document__intro">
            <h2 class="settings-document__title">Settings</h2>
          </header>
          <section
            v-for="section in sections"
            :id="section.anchorId"
            :key="section.id"
            :data-testid="section.anchorId"
            class="settings-document__section"
          >
            <component :is="sectionComponents[section.id]" />
          </section>
        </div>
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import SettingsGlobal from "./SettingsGlobal.vue";
import SettingsProfiles from "./SettingsProfiles.vue";
import SettingsRules from "./SettingsRules.vue";
import SettingsTranscription from "./SettingsTranscription.vue";
import SettingsMediaServer from "./SettingsMediaServer.vue";
import SettingsCache from "./SettingsCache.vue";
import SettingsNav from "./SettingsNav.vue";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "./settingsSections";

const sections = SETTINGS_SECTIONS;
const currentSection = ref<SettingsSectionId>("general");
const contentRef = ref<HTMLElement | null>(null);
let sectionObserver: IntersectionObserver | null = null;

const sectionComponents: Record<SettingsSectionId, unknown> = {
  general: SettingsGlobal,
  profiles: SettingsProfiles,
  rules: SettingsRules,
  transcription: SettingsTranscription,
  "media-server": SettingsMediaServer,
  cache: SettingsCache
};

function sectionIdFromAnchor(anchorId: string): SettingsSectionId {
  return anchorId.replace("settings-section-", "") as SettingsSectionId;
}

function scrollToSection(id: SettingsSectionId) {
  const target = document.getElementById(`settings-section-${id}`);
  if (!target) {
    return;
  }

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

  for (const section of sections) {
    const element = document.getElementById(section.anchorId);
    if (element) {
      sectionObserver.observe(element);
    }
  }
});

onBeforeUnmount(() => {
  sectionObserver?.disconnect();
});
</script>
