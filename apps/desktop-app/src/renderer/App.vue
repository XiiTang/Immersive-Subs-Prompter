<template>
  <div class="window">
    <div class="window__content">
      <div class="primary-view">
        <SubtitleView />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import SubtitleView from "./components/subtitle/SubtitleView.vue";
import { useDesktopStore } from "./stores/desktop";
import { normalizeLanguage } from "./i18n.js";

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
