<template>
  <select
    class="ui-select"
    :value="modelValue"
    :disabled="disabled"
    :aria-label="ariaLabel"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-for="option in options" :key="option.value" :value="option.value" :disabled="option.disabled">
      {{ option.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  disabled?: boolean;
  ariaLabel?: string;
}>();

defineEmits<{ "update:modelValue": [value: string] }>();
</script>
