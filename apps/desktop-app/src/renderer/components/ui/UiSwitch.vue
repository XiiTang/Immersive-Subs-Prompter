<template>
  <label class="ui-switch" :class="{ 'ui-switch--disabled': disabled }">
    <SwitchRoot
      class="ui-switch__control"
      data-slot="switch"
      :model-value="modelValue"
      :disabled="disabled"
      :aria-label="label"
      :data-testid="inputTestId || undefined"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <SwitchThumb class="ui-switch__thumb" />
    </SwitchRoot>
    <span v-if="showLabel" class="ui-switch__label toggle__text">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from "reka-ui";

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
