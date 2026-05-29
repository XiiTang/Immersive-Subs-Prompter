<template>
  <input
    v-bind="attrs"
    class="ui-slider"
    data-slot="slider"
    type="range"
    :min="min"
    :max="max"
    :step="step"
    :value="modelValue"
    :disabled="disabled"
    :aria-label="sliderAriaLabel"
    :aria-labelledby="fieldLabelledBy"
    :aria-describedby="fieldDescribedBy"
    :style="sliderStyle"
    @pointerdown="$emit('pointerdown', $event)"
    @pointercancel="$emit('pointercancel', $event)"
    @input="handleInput"
    @change="$emit('change', $event)"
  />
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";
import { useUiFieldControl } from "./fieldContext";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const props = withDefaults(
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
const { fieldLabelledBy, fieldDescribedBy } = useUiFieldControl({
  hasExplicitLabel: () => Boolean(attrs["aria-label"] || attrs["aria-labelledby"]),
  describedBy: () => String(attrs["aria-describedby"] ?? "")
});
const sliderAriaLabel = computed(() =>
  fieldLabelledBy.value ? undefined : String(attrs["aria-label"] ?? props.label)
);
const sliderStyle = computed(() => ({
  "--slider-progress": `${sliderProgress.value}%`,
  ...props.fillStyle
}));
const sliderProgress = computed(() => {
  const min = Number(props.min);
  const max = Number(props.max);
  const value = Number(props.modelValue);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
});

function handleInput(event: Event) {
  const value = Number((event.target as HTMLInputElement).value);
  if (Number.isFinite(value)) {
    emit("update:modelValue", value);
  }
  emit("input", event);
}
</script>
