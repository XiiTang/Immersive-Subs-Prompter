<template>
  <button
    ref="triggerEl"
    v-bind="attrs"
    class="ui-select"
    :class="`ui-select--${size}`"
    data-slot="select-trigger"
    type="button"
    role="combobox"
    aria-haspopup="listbox"
    :aria-expanded="open"
    :aria-controls="contentId"
    :aria-label="triggerAriaLabel"
    :aria-labelledby="fieldLabelledBy"
    :aria-describedby="fieldDescribedBy"
    :disabled="disabled"
    :data-disabled="disabled ? '' : undefined"
    :data-state="open ? 'open' : 'closed'"
    @pointerdown="handleTriggerPointerDown"
    @keydown="handleTriggerKeydown"
  >
    <span class="ui-select__value" :style="selectedPreviewStyle">{{ selectedLabel }}</span>
    <span class="ui-select__icon" aria-hidden="true">
      <IconChevronDown size="sm" />
    </span>
  </button>
  <Teleport to="body">
    <div
      v-if="open"
      :id="contentId"
      ref="contentEl"
      class="ui-select-content"
      data-slot="select-content"
      role="listbox"
      :style="contentStyle"
      @keydown="handleListKeydown"
    >
      <div class="ui-select-content__viewport">
        <button
          v-for="(option, index) in options"
          :key="option.value"
          type="button"
          class="ui-select-item"
          data-slot="select-item"
          role="option"
          :aria-selected="option.value === modelValue"
          :data-value="option.value"
          :data-state="option.value === modelValue ? 'checked' : undefined"
          :data-highlighted="index === highlightedIndex ? '' : undefined"
          :data-disabled="option.disabled ? '' : undefined"
          :disabled="option.disabled"
          @click="selectOption(option)"
          @mouseenter="highlightOption(index)"
          @keydown="handleOptionKeydown($event, index)"
        >
          <span v-if="option.value === modelValue" class="ui-select-item__indicator">
            <IconCheck class="ui-select-item__check" size="sm" />
          </span>
          <span class="ui-select-item__label" :style="optionPreviewStyle(option)">{{ option.label }}</span>
        </button>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
let nextSelectId = 0;
</script>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, watch, type CSSProperties } from "vue";
import { IconCheck, IconChevronDown } from "../icons";
import { useUiFieldControl } from "./fieldContext";

defineOptions({ inheritAttrs: false });

const attrs = useAttrs();

type UiSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
  fontFamilyPreview?: string;
};

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: UiSelectOption[];
    disabled?: boolean;
    ariaLabel?: string;
    placeholder?: string;
    size?: "default" | "compact";
  }>(),
  {
    disabled: false,
    ariaLabel: "",
    placeholder: "",
    size: "default"
  }
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const { fieldLabelledBy, fieldDescribedBy } = useUiFieldControl({
  hasExplicitLabel: () => Boolean(props.ariaLabel || attrs["aria-label"] || attrs["aria-labelledby"]),
  describedBy: () => String(attrs["aria-describedby"] ?? "")
});
const triggerAriaLabel = computed(() => props.ariaLabel || String(attrs["aria-label"] ?? "") || undefined);
const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue));
const selectedLabel = computed(() => selectedOption.value?.label ?? props.placeholder);
const selectedPreviewStyle = computed(() => optionPreviewStyle(selectedOption.value));
const enabledIndexes = computed(() =>
  props.options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabled)
    .map(({ index }) => index)
);

const contentId = `ui-select-${nextSelectId++}`;
const open = ref(false);
const highlightedIndex = ref(-1);
const triggerEl = ref<HTMLButtonElement | null>(null);
const contentEl = ref<HTMLElement | null>(null);
const contentStyle = ref<CSSProperties>({});

watch(open, (isOpen) => {
  if (isOpen) {
    setInitialHighlight();
    void nextTick(() => {
      updateContentPosition();
      document.addEventListener("pointerdown", handleDocumentPointerDown, true);
      document.addEventListener("keydown", handleDocumentKeydown, true);
      window.addEventListener("resize", updateContentPosition);
      window.addEventListener("scroll", updateContentPosition, true);
    });
  } else {
    removeDocumentListeners();
  }
});

onBeforeUnmount(removeDocumentListeners);

function optionPreviewStyle(option: UiSelectOption | undefined): CSSProperties | undefined {
  return option?.fontFamilyPreview ? { fontFamily: option.fontFamilyPreview } : undefined;
}

function handleTriggerPointerDown(event: PointerEvent) {
  if (props.disabled || event.button !== 0) {
    return;
  }
  event.preventDefault();
  triggerEl.value?.focus();
  toggleOpen();
}

function handleTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    openSelect();
    moveHighlight(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    openSelect();
    moveHighlight(-1);
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    openSelect();
    highlightEdge(event.key === "Home" ? "first" : "last");
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    if (!open.value) {
      openSelect();
      return;
    }
    selectHighlighted();
  }
}

function handleListKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveHighlight(1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    moveHighlight(-1);
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    highlightEdge(event.key === "Home" ? "first" : "last");
    return;
  }
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    selectHighlighted();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeSelect(true);
  }
}

function handleOptionKeydown(event: KeyboardEvent, index: number) {
  highlightedIndex.value = index;
  handleListKeydown(event);
}

function toggleOpen() {
  if (open.value) {
    closeSelect(false);
  } else {
    openSelect();
  }
}

function openSelect() {
  if (!props.disabled) {
    open.value = true;
  }
}

function closeSelect(returnFocus: boolean) {
  open.value = false;
  highlightedIndex.value = -1;
  if (returnFocus) {
    void nextTick(() => triggerEl.value?.focus());
  }
}

function selectOption(option: UiSelectOption) {
  if (option.disabled) {
    return;
  }
  emit("update:modelValue", option.value);
  closeSelect(true);
}

function selectHighlighted() {
  const option = props.options[highlightedIndex.value];
  if (option) {
    selectOption(option);
  }
}

function setInitialHighlight() {
  const selectedIndex = props.options.findIndex((option) => option.value === props.modelValue && !option.disabled);
  highlightedIndex.value = selectedIndex >= 0 ? selectedIndex : enabledIndexes.value[0] ?? -1;
}

function highlightOption(index: number) {
  if (!props.options[index]?.disabled) {
    highlightedIndex.value = index;
  }
}

function moveHighlight(delta: 1 | -1) {
  const indexes = enabledIndexes.value;
  if (!indexes.length) {
    highlightedIndex.value = -1;
    return;
  }
  const currentPosition = indexes.indexOf(highlightedIndex.value);
  const nextPosition = currentPosition < 0
    ? (delta > 0 ? 0 : indexes.length - 1)
    : (currentPosition + delta + indexes.length) % indexes.length;
  highlightedIndex.value = indexes[nextPosition] ?? -1;
}

function highlightEdge(edge: "first" | "last") {
  const indexes = enabledIndexes.value;
  highlightedIndex.value = edge === "first"
    ? indexes[0] ?? -1
    : indexes[indexes.length - 1] ?? -1;
}

function handleDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node | null;
  if (!target) {
    return;
  }
  if (triggerEl.value?.contains(target) || contentEl.value?.contains(target)) {
    return;
  }
  closeSelect(false);
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeSelect(true);
  }
}

function updateContentPosition() {
  const trigger = triggerEl.value;
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  const minWidth = Math.max(180, rect.width);
  const left = Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - minWidth - 8));
  const belowTop = rect.bottom + 4;
  const aboveTop = rect.top - 264;
  const top = belowTop + 260 <= window.innerHeight ? belowTop : Math.max(8, aboveTop);
  contentStyle.value = {
    "--ui-select-trigger-width": `${rect.width}px`,
    left: `${left}px`,
    minWidth: `${minWidth}px`,
    position: "fixed",
    top: `${top}px`
  };
}

function removeDocumentListeners() {
  document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
  document.removeEventListener("keydown", handleDocumentKeydown, true);
  window.removeEventListener("resize", updateContentPosition);
  window.removeEventListener("scroll", updateContentPosition, true);
}
</script>
