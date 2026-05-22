<template>
  <p class="ui-empty-state">{{ message }}</p>
</template>

<script setup lang="ts">
defineProps<{ message: string }>();
</script>
