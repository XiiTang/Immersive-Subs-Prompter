<template>
  <section class="ui-section">
    <header class="ui-section__header">
      <h2 class="ui-section__title">{{ title }}</h2>
      <slot name="actions" />
    </header>
    <div class="ui-section__body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string }>();
</script>
