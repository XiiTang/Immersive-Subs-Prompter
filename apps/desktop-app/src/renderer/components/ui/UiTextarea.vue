<template>
  <textarea
    v-bind="attrs"
    class="ui-textarea"
    :value="modelValue"
    :rows="rows"
    :disabled="disabled"
    :placeholder="placeholder"
    :aria-labelledby="fieldLabelledBy"
    :aria-describedby="fieldDescribedBy"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>

<script setup lang="ts">
import { useAttrs } from "vue";
import { useUiFieldControl } from "./fieldContext";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
withDefaults(
  defineProps<{
    modelValue: string;
    rows?: number;
    disabled?: boolean;
    placeholder?: string;
  }>(),
  {
    rows: 3,
    disabled: false,
    placeholder: ""
  }
);

defineEmits<{ "update:modelValue": [value: string] }>();
const { fieldLabelledBy, fieldDescribedBy } = useUiFieldControl({
  hasExplicitLabel: () => Boolean(attrs["aria-label"] || attrs["aria-labelledby"]),
  describedBy: () => String(attrs["aria-describedby"] ?? "")
});
</script>
