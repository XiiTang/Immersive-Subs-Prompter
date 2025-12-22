<template>
  <section class="status-banner" :class="banner.modifier">
    <span>{{ banner.text }}</span>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  banner: {
    text: string;
    modifier: string;
  };
}>();
</script>
