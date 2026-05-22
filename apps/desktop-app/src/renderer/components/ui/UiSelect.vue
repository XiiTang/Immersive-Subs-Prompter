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
      :aria-label="ariaLabel"
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
            :value="toRekaValue(option.value)"
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

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const EMPTY_VALUE = "__ui_select_empty_value__";

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

const rekaModelValue = computed(() => toRekaValue(props.modelValue));
const selectedLabel = computed(() => {
  const selectedOption = props.options.find((option) => option.value === props.modelValue);
  return selectedOption?.label ?? props.placeholder;
});

function toRekaValue(value: string) {
  return value === "" ? EMPTY_VALUE : value;
}

function emitValue(value: string | string[] | undefined) {
  if (typeof value === "string") {
    emit("update:modelValue", value === EMPTY_VALUE ? "" : value);
    return;
  }
  emit("update:modelValue", props.modelValue);
}
</script>
