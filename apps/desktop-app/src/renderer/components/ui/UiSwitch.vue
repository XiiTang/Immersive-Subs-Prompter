<template>
  <label class="ui-switch" :class="{ 'ui-switch--disabled': disabled }">
    <SwitchRoot
      class="ui-switch__control"
      data-slot="switch"
      :model-value="modelValue"
      :disabled="disabled"
      :aria-label="switchAriaLabel"
      :aria-labelledby="fieldLabelledBy"
      :aria-describedby="fieldDescribedBy"
      :data-testid="inputTestId || undefined"
      @update:model-value="$emit('update:modelValue', $event)"
    >
      <SwitchThumb class="ui-switch__thumb" />
    </SwitchRoot>
    <span v-if="showLabel" class="ui-switch__label toggle__text">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { SwitchRoot, SwitchThumb } from "reka-ui";
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

defineEmits<{ "update:modelValue": [value: boolean] }>();
const { fieldLabelledBy, fieldDescribedBy } = useUiFieldControl();
const switchAriaLabel = computed(() => (fieldLabelledBy.value ? undefined : props.label));
</script>
