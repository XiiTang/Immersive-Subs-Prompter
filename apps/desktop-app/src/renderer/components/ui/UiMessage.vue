<template>
  <p class="ui-message" :class="`ui-message--${tone}`" :role="role">
    <slot />
  </p>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    tone?: "info" | "success" | "warning" | "danger";
  }>(),
  {
    tone: "info"
  }
);

const role = computed(() => (props.tone === "danger" ? "alert" : "status"));
</script>
