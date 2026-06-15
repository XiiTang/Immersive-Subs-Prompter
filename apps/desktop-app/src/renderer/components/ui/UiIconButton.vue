<template>
  <button
    class="ui-icon-button"
    :class="[`ui-icon-button--${variant}`, `ui-icon-button--${size}`, { 'is-active': active }]"
    data-slot="icon-button"
    :data-variant="variant"
    :data-size="size"
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
    size?: "chip" | "xs" | "compact" | "sm" | "md";
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
