<template>
  <span class="ui-status" :class="`ui-status--${tone}`">
    <span class="ui-status__dot" aria-hidden="true" />
    <span><slot /></span>
  </span>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ tone?: "neutral" | "success" | "warning" | "danger" | "info" }>(),
  { tone: "neutral" }
);
</script>
