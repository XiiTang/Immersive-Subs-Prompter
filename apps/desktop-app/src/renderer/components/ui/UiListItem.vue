<template>
  <component
    :is="as"
    class="ui-list-item"
    :class="[`ui-list-item--${density}`, { 'is-selected': selected, 'is-highlighted': highlighted, 'is-disabled': disabled }]"
    :type="as === 'button' ? 'button' : undefined"
    :disabled="as === 'button' ? disabled : undefined"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    as?: "button" | "div" | "article";
    density?: "default" | "compact";
    selected?: boolean;
    highlighted?: boolean;
    disabled?: boolean;
  }>(),
  {
    as: "div",
    density: "default",
    selected: false,
    highlighted: false,
    disabled: false
  }
);
</script>
