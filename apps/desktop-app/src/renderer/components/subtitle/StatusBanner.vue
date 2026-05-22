<template>
  <UiStatus v-if="banner.text" class="status-banner" :tone="banner.tone">
    {{ banner.text }}
  </UiStatus>
</template>

<script setup lang="ts">
import { UiStatus } from "../ui";

const { banner } = defineProps<{
  banner: {
    text: string;
    tone: "neutral" | "success" | "warning" | "danger" | "info";
  };
}>();
</script>
