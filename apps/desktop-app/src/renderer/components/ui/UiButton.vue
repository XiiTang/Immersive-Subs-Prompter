<template>
  <button
    class="ui-button"
    :class="[`ui-button--${variant}`, { 'ui-button--block': block }]"
    :type="type"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost" | "danger";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    block?: boolean;
  }>(),
  {
    variant: "secondary",
    type: "button",
    disabled: false,
    block: false
  }
);
</script>
