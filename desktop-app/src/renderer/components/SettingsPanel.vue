<template>
  <section class="settings-panel" aria-hidden="false">
    <div class="settings-panel__header">
      <button type="button" class="text-button" @click="store.setSettingsOpen(false)">
        {{ t("settings-back", "← Back") }}
      </button>
      <div class="settings-panel__title">{{ t("settings-title", "Settings") }}</div>
    </div>
    <div class="settings-panel__content" v-if="store.settings">
      <SettingsGlobal />
      <SettingsProfiles />
      <SettingsRules />
      <SettingsTranscription />
      <SettingsMediaServer />
      <SettingsCache />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDesktopStore } from "../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../i18n";

import SettingsGlobal from "./settings/SettingsGlobal.vue";
import SettingsProfiles from "./settings/SettingsProfiles.vue";
import SettingsRules from "./settings/SettingsRules.vue";
import SettingsTranscription from "./settings/SettingsTranscription.vue";
import SettingsMediaServer from "./settings/SettingsMediaServer.vue";
import SettingsCache from "./settings/SettingsCache.vue";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
</script>
