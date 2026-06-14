<template>
  <p class="ui-message" :class="[`ui-message--${tone}`, `ui-message--${density}`]" data-slot="message" :role="role">
    <slot />
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    tone?: "neutral" | "info" | "success" | "warning" | "danger";
    density?: "default" | "compact";
  }>(),
  {
    tone: "info",
    density: "default"
  }
);

const role = computed(() => (props.tone === "danger" ? "alert" : "status"));
</script>
