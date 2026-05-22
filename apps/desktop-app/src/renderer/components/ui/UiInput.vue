<template>
  <input
    class="ui-input"
    :type="type"
    :value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :disabled="disabled"
    :readonly="readonly"
    :autocomplete="autocomplete"
    :placeholder="placeholder"
    @input="handleInput"
  />
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    type?: string;
    min?: string | number;
    max?: string | number;
    step?: string | number;
    disabled?: boolean;
    readonly?: boolean;
    autocomplete?: string;
    placeholder?: string;
  }>(),
  {
    type: "text",
    min: undefined,
    max: undefined,
    step: undefined,
    disabled: false,
    readonly: false,
    autocomplete: "off",
    placeholder: ""
  }
);

const emit = defineEmits<{ "update:modelValue": [value: string | number] }>();

function handleInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  emit("update:modelValue", props.type === "number" ? Number(value) : value);
}
</script>
