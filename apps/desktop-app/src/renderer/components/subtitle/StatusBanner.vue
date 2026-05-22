<template>
  <p class="status-banner" :class="`status-banner--${banner.modifier}`">
    <span>{{ banner.text }}</span>
  </p>
</template>

<script setup lang="ts">
const { banner } = defineProps<{
  banner: {
    text: string;
    modifier: string;
  };
}>();
</script>
