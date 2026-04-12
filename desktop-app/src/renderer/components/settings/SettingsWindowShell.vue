<template>
  <section class="settings-window-shell">
    <header class="settings-window-shell__header">Settings</header>
    <div class="settings-window-shell__body">
      <SettingsNav :sections="sections" :current-section="currentSection" @select="currentSection = $event" />
      <main class="settings-window-shell__content" data-testid="settings-content">
        <SettingsGlobal v-if="currentSection === 'general'" />
        <SettingsProfiles v-else-if="currentSection === 'profiles'" />
        <SettingsRules v-else-if="currentSection === 'rules'" />
        <SettingsTranscription v-else-if="currentSection === 'transcription'" />
        <SettingsMediaServer v-else-if="currentSection === 'media-server'" />
        <SettingsCache v-else-if="currentSection === 'cache'" />
      </main>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
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
</script>
