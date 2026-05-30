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
      <span class="ui-select__value" :style="selectedPreviewStyle">{{ selectedLabel }}</span>
      <SelectIcon class="ui-select__icon" aria-hidden="true">
        <IconChevronDown size="sm" />
      </SelectIcon>
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
            <SelectItemIndicator class="ui-select-item__indicator">
              <IconCheck class="ui-select-item__check" size="sm" />
            </SelectItemIndicator>
            <SelectItemText>
              <span class="ui-select-item__label" :style="optionPreviewStyle(option)">{{ option.label }}</span>
            </SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
import { computed, useAttrs, type CSSProperties } from "vue";
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from "reka-ui";
import { IconCheck, IconChevronDown } from "../icons";
import { useUiFieldControl } from "./fieldContext";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();

type UiSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  fontFamilyPreview?: string;
};

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: UiSelectOption[];
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
const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue));
const selectedLabel = computed(() => {
  return selectedOption.value?.label ?? props.placeholder;
});
const selectedPreviewStyle = computed(() => optionPreviewStyle(selectedOption.value));

function optionPreviewStyle(option: UiSelectOption | undefined): CSSProperties | undefined {
  return option?.fontFamilyPreview ? { fontFamily: option.fontFamilyPreview } : undefined;
}

function emitValue(value: string | string[] | undefined) {
  if (typeof value === "string") {
    emit("update:modelValue", value);
  }
}
</script>
