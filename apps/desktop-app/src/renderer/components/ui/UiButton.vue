<template>
  <button
    class="ui-button"
    :class="[
      `ui-button--${variant}`,
      `ui-button--${size}`,
      { 'ui-button--block': block }
    ]"
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :type="type"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "ghost" | "danger" | "editable" | "nav";
    size?: "sm" | "md" | "lg";
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    block?: boolean;
  }>(),
  {
    variant: "secondary",
    size: "md",
    type: "button",
    disabled: false,
    block: false
  }
);
</script>
