<template>
  <label class="ui-switch" :class="{ 'ui-switch--disabled': disabled }">
    <button
      type="button"
      class="ui-switch__control"
      data-slot="switch"
      role="switch"
      :aria-checked="modelValue"
      :disabled="disabled"
      :aria-label="switchAriaLabel"
      :aria-labelledby="fieldLabelledBy"
      :aria-describedby="fieldDescribedBy"
      :data-state="modelValue ? 'checked' : 'unchecked'"
      :data-testid="inputTestId || undefined"
      @click="toggle"
    >
      <span class="ui-switch__thumb" />
    </button>
    <span v-if="showLabel" class="ui-switch__label toggle__text">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useUiFieldControl } from "./fieldContext";

const props = withDefaults(
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

const emit = defineEmits<{ "update:modelValue": [value: boolean] }>();
const { fieldLabelledBy, fieldDescribedBy } = useUiFieldControl();
const switchAriaLabel = computed(() => (fieldLabelledBy.value ? undefined : props.label));

function toggle() {
  if (!props.disabled) {
    emit("update:modelValue", !props.modelValue);
  }
}
</script>
