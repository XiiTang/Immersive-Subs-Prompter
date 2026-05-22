<template>
  <div class="settings-window">
    <SettingsWindowShell />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import SettingsWindowShell from "./components/settings/SettingsWindowShell.vue";
import { useDesktopStore } from "./stores/desktop";
import { normalizeLanguage } from "./i18n";
import { useDocumentTheme } from "./theme";

const store = useDesktopStore();
useDocumentTheme(computed(() => store.settings?.global.appearance.theme));

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
