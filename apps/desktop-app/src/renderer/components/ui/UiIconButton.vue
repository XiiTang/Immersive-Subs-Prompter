<template>
  <button
    class="ui-icon-button"
    :class="[`ui-icon-button--${variant}`, `ui-icon-button--${size}`, { 'is-active': active }]"
    type="button"
    :disabled="disabled"
    :aria-label="label"
    :aria-pressed="pressed"
    :title="title || label"
  >
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    title?: string;
    variant?: "ghost" | "secondary" | "danger";
    size?: "sm" | "md";
    disabled?: boolean;
    active?: boolean;
    pressed?: boolean | "true" | "false" | "mixed";
  }>(),
  {
    title: "",
    variant: "ghost",
    size: "md",
    disabled: false,
    active: false,
    pressed: undefined
  }
);
</script>
