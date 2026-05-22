<template>
  <UiStatus v-if="banner.text" class="status-banner" :tone="tone">
    {{ banner.text }}
  </UiStatus>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { UiStatus } from "../ui";

const { banner } = defineProps<{
  banner: {
    text: string;
    modifier: string;
  };
}>();

const tone = computed(() => {
  if (banner.modifier === "error") return "danger";
  if (banner.modifier === "warning") return "warning";
  if (banner.modifier === "success" || banner.modifier === "ready") return "success";
  return "info";
});
</script>
