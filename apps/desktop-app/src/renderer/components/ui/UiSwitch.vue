<template>
  <label class="ui-switch">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :data-testid="inputTestId || undefined"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="ui-switch__track" aria-hidden="true">
      <span class="ui-switch__thumb" />
    </span>
    <span v-if="showLabel" class="ui-switch__label toggle__text">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    label: string;
    inputTestId?: string;
    showLabel?: boolean;
    disabled?: boolean;
  }>(),
  {
    inputTestId: "",
    showLabel: true,
    disabled: false
  }
);

defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>
