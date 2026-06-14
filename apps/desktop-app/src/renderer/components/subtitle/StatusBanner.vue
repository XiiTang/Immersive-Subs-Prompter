<template>
  <UiMessage v-if="banner.text" density="compact" :tone="banner.tone">
    {{ banner.text }}
  </UiMessage>
</template>

<script setup lang="ts">
import { UiMessage } from "../ui";

const { banner } = defineProps<{
  banner: {
    text: string;
    tone: "neutral" | "success" | "warning" | "danger" | "info";
  };
}>();
</script>
