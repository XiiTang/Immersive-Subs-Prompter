<template>
  <textarea
    class="ui-textarea"
    :value="modelValue"
    :rows="rows"
    :disabled="disabled"
    :placeholder="placeholder"
    @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>

<script setup lang="ts">
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
</script>
