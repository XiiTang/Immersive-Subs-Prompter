<template>
  <component
    :is="as"
    class="ui-list-item"
    :class="{ 'is-selected': selected, 'is-disabled': disabled }"
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
    selected?: boolean;
    disabled?: boolean;
  }>(),
  {
    as: "div",
    selected: false,
    disabled: false
  }
);
</script>
