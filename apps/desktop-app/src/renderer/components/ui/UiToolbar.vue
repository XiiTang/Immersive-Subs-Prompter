<template>
  <div
    class="ui-toolbar"
    :class="[`ui-toolbar--${density}`, { 'ui-toolbar--wrap': wrap }]"
    data-slot="toolbar"
    role="toolbar"
    :aria-label="label"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    density?: "compact" | "default";
    wrap?: boolean;
  }>(),
  {
    density: "default",
    wrap: false
  }
);
</script>
