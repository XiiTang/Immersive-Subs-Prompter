<template>
  <div class="ui-segmented" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="ui-segmented__item"
      :class="{ 'is-selected': modelValue === option.value }"
      role="radio"
      :aria-checked="modelValue === option.value"
      :disabled="option.disabled"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string;
  label: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}>();

defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();
</script>
