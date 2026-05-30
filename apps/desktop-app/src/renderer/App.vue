<template>
  <div class="window">
    <div class="window__content">
      <div class="primary-view">
        <SubtitleView v-if="store.settings" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import SubtitleView from "./components/subtitle/SubtitleView.vue";
import { useDesktopStore } from "./stores/desktop";
import { normalizeLanguage } from "./i18n.js";
import { useDocumentTheme } from "./theme";

const store = useDesktopStore();
useDocumentTheme(computed(() => store.settings?.global.appearance.theme));

onMounted(() => {
  document.body.classList.add("main-window-body");
  store.initialize();
});

onBeforeUnmount(() => {
  document.body.classList.remove("main-window-body");
});

watch(
  () => store.settings?.global.language,
  (lang) => {
    document.documentElement.lang = normalizeLanguage(lang);
  },
  { immediate: true }
);
</script>
