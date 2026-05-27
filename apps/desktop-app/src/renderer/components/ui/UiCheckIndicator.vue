<template>
  <CheckboxRoot
    class="ui-check-indicator"
    :class="[`ui-check-indicator--${tone}`, `ui-check-indicator--${size}`]"
    data-slot="check-indicator"
    :data-testid="testId || undefined"
    :model-value="checked"
    :disabled="disabled"
    :aria-label="label"
    @update:model-value="handleUpdate"
  >
    <CheckboxIndicator class="ui-check-indicator__check">
      <IconCheck size="sm" />
    </CheckboxIndicator>
  </CheckboxRoot>
</template>

<script setup lang="ts">
import { CheckboxIndicator, CheckboxRoot } from "reka-ui";
import { IconCheck } from "../icons";

withDefaults(
  defineProps<{
    checked: boolean;
    label: string;
    tone?: "neutral" | "success" | "info";
    size?: "sm" | "md";
    testId?: string;
    disabled?: boolean;
  }>(),
  {
    tone: "neutral",
    size: "sm",
    testId: "",
    disabled: false
  }
);

const emit = defineEmits<{
  "update:checked": [checked: boolean];
}>();

function handleUpdate(value: boolean | "indeterminate") {
  if (typeof value === "boolean") {
    emit("update:checked", value);
  }
}
</script>
