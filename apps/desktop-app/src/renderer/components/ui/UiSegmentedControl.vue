<template>
  <RadioGroupRoot
    class="ui-segmented"
    data-slot="segmented-control"
    :model-value="modelValue"
    :aria-label="label"
    orientation="horizontal"
    @update:model-value="emitValue"
  >
    <RadioGroupItem
      v-for="option in options"
      :key="option.value"
      class="ui-segmented__item"
      data-slot="segmented-control-item"
      :class="{ 'is-selected': modelValue === option.value }"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </RadioGroupItem>
  </RadioGroupRoot>
</template>

<script setup lang="ts">
import { RadioGroupItem, RadioGroupRoot } from "reka-ui";

defineProps<{
  modelValue: string;
  label: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

function emitValue(value: unknown) {
  if (typeof value === "string") {
    emit("update:modelValue", value);
  }
}
</script>
