<template>
  <div
    class="ui-segmented"
    data-slot="segmented-control"
    role="radiogroup"
    :aria-label="label"
    @keydown="handleKeydown"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      class="ui-segmented__item"
      data-slot="segmented-control-item"
      :class="{ 'is-selected': modelValue === option.value }"
      role="radio"
      :aria-checked="modelValue === option.value"
      :disabled="option.disabled"
      @click="selectOption(option.value, option.disabled)"
      @focus="focusedIndex = index"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  modelValue: string;
  label: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

const focusedIndex = ref(0);

function selectOption(value: string, disabled: boolean | undefined) {
  if (!disabled) {
    emit("update:modelValue", value);
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
    return;
  }
  event.preventDefault();
  if (event.key === "Enter" || event.key === " ") {
    const option = props.options[focusedIndex.value];
    if (option) {
      selectOption(option.value, option.disabled);
    }
    return;
  }
  const enabledIndexes = props.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabled)
    .map(({ index }) => index);
  if (!enabledIndexes.length) {
    return;
  }
  const selectedIndex = props.options.findIndex((option) => option.value === props.modelValue);
  const currentIndex = enabledIndexes.includes(focusedIndex.value) ? focusedIndex.value : selectedIndex;
  const currentPosition = enabledIndexes.indexOf(currentIndex);
  let nextIndex = enabledIndexes[0]!;
  if (event.key === "End") {
    nextIndex = enabledIndexes[enabledIndexes.length - 1]!;
  } else if (currentPosition < 0) {
    nextIndex = event.key === "ArrowLeft" || event.key === "ArrowUp"
      ? enabledIndexes[enabledIndexes.length - 1]!
      : enabledIndexes[0]!;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = enabledIndexes[(currentPosition - 1 + enabledIndexes.length) % enabledIndexes.length]!;
  } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = enabledIndexes[(currentPosition + 1) % enabledIndexes.length]!;
  }
  focusedIndex.value = nextIndex;
  selectOption(props.options[nextIndex]!.value, false);
}
</script>
