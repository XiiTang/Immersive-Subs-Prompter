<template>
  <input
    class="ui-slider"
    data-slot="slider"
    type="range"
    :min="min"
    :max="max"
    :step="step"
    :value="modelValue"
    :disabled="disabled"
    :aria-label="label"
    :style="fillStyle"
    @pointerdown="$emit('pointerdown', $event)"
    @pointercancel="$emit('pointercancel', $event)"
    @input="handleInput"
    @change="$emit('change', $event)"
  />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    label: string;
    disabled?: boolean;
    fillStyle?: Record<string, string>;
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    disabled: false,
    fillStyle: () => ({})
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
  input: [event: Event];
  change: [event: Event];
  pointerdown: [event: PointerEvent];
  pointercancel: [event: PointerEvent];
}>();

function handleInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(value)) {
    emit("update:modelValue", value);
  }
  emit("input", event);
}
</script>
