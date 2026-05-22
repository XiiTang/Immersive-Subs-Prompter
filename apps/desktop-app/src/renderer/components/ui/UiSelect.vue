<template>
  <SelectRoot
    :model-value="rekaModelValue"
    :disabled="disabled"
    @update:model-value="emitValue"
  >
    <SelectTrigger
      v-bind="attrs"
      class="ui-select"
      data-slot="select-trigger"
      :aria-label="triggerAriaLabel"
      :aria-labelledby="fieldLabelledBy"
      :aria-describedby="fieldDescribedBy"
    >
      <span class="ui-select__value">{{ selectedLabel }}</span>
      <SelectIcon class="ui-select__icon" aria-hidden="true">⌄</SelectIcon>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent class="ui-select-content" data-slot="select-content" position="popper">
        <SelectViewport class="ui-select-content__viewport">
          <SelectItem
            v-for="option in options"
            :key="option.value"
            class="ui-select-item"
            data-slot="select-item"
            :data-value="option.value"
            :value="option.value"
            :disabled="option.disabled"
          >
            <SelectItemText>{{ option.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
import { computed, useAttrs } from "vue";
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from "reka-ui";
import { useUiFieldControl } from "./fieldContext";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: Array<{ value: string; label: string; disabled?: boolean }>;
    disabled?: boolean;
    ariaLabel?: string;
    placeholder?: string;
  }>(),
  {
    disabled: false,
    ariaLabel: "",
    placeholder: ""
  }
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const { fieldLabelledBy, fieldDescribedBy } = useUiFieldControl({
  hasExplicitLabel: () => Boolean(props.ariaLabel || attrs["aria-label"] || attrs["aria-labelledby"]),
  describedBy: () => String(attrs["aria-describedby"] ?? "")
});
const rekaModelValue = computed(() => props.modelValue);
const triggerAriaLabel = computed(() => props.ariaLabel || String(attrs["aria-label"] ?? "") || undefined);
const selectedLabel = computed(() => {
  const selectedOption = props.options.find((option) => option.value === props.modelValue);
  return selectedOption?.label ?? props.placeholder;
});

function emitValue(value: string | string[] | undefined) {
  if (typeof value === "string") {
    emit("update:modelValue", value);
  }
}
</script>
