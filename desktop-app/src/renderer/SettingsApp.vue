<template>
  <div class="settings-window">
    <SettingsWindowShell />
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import SettingsWindowShell from "./components/settings/SettingsWindowShell.vue";
import { useDesktopStore } from "./stores/desktop";
import { normalizeLanguage } from "./i18n";

const store = useDesktopStore();

onMounted(() => {
  store.initialize();
});

watch(
  () => store.settings?.global.language,
  (lang) => {
    document.documentElement.lang = normalizeLanguage(lang);
  },
  { immediate: true }
);
</script>
