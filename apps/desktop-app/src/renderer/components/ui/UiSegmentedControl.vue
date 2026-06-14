<template>
  <div
    class="ui-segmented"
    data-slot="segmented-control"
    role="radiogroup"
    :aria-label="label"
    @keydown="handleKeydown"
    @focusout="handleFocusout"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      ref="itemEls"
      type="button"
      class="ui-segmented__item"
      data-slot="segmented-control-item"
      :class="{ 'is-selected': modelValue === option.value }"
      role="radio"
      :aria-checked="modelValue === option.value"
      :disabled="option.disabled"
      :tabindex="itemTabIndex(index)"
      @click="selectOption(option.value, option.disabled)"
      @focus="focusedIndex = index"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

const props = defineProps<{
  modelValue: string;
  label: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: string): void;
}>();

const focusedIndex = ref(-1);
const itemEls = ref<HTMLButtonElement[]>([]);
const enabledIndexes = computed(() =>
  props.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabled)
    .map(({ index }) => index)
);
const selectedIndex = computed(() =>
  props.options.findIndex((option) => option.value === props.modelValue && !option.disabled)
);
const tabStopIndex = computed(() => {
  if (enabledIndexes.value.includes(focusedIndex.value)) {
    return focusedIndex.value;
  }
  return selectedIndex.value >= 0
    ? selectedIndex.value
    : enabledIndexes.value[0] ?? -1;
});

function selectOption(value: string, disabled: boolean | undefined) {
  if (!disabled) {
    emit("update:modelValue", value);
  }
}

function itemTabIndex(index: number) {
  return index === tabStopIndex.value ? 0 : -1;
}

function handleFocusout(event: FocusEvent) {
  const nextTarget = event.relatedTarget as Node | null;
  if (!nextTarget || !(event.currentTarget as HTMLElement).contains(nextTarget)) {
    focusedIndex.value = -1;
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
  const indexes = enabledIndexes.value;
  if (!indexes.length) {
    return;
  }
  const currentPosition = indexes.indexOf(tabStopIndex.value);
  let nextIndex = indexes[0]!;
  if (event.key === "End") {
    nextIndex = indexes[indexes.length - 1]!;
  } else if (currentPosition < 0) {
    nextIndex = event.key === "ArrowLeft" || event.key === "ArrowUp"
      ? indexes[indexes.length - 1]!
      : indexes[0]!;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    nextIndex = indexes[(currentPosition - 1 + indexes.length) % indexes.length]!;
  } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    nextIndex = indexes[(currentPosition + 1) % indexes.length]!;
  }
  focusedIndex.value = nextIndex;
  selectOption(props.options[nextIndex]!.value, false);
  void nextTick(() => itemEls.value[nextIndex]?.focus());
}
</script>
