<template>
  <component
    :is="as"
    class="ui-surface"
    :class="[`ui-surface--${variant}`, { 'ui-surface--flush': !padded }]"
    data-slot="surface"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: "div" | "section" | "article";
    variant?: "default" | "muted" | "floating" | "transparent";
    padded?: boolean;
  }>(),
  {
    as: "div",
    variant: "default",
    padded: true
  }
);
</script>
