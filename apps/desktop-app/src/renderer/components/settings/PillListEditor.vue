<template>
  <div class="pill-list-editor">
    <div v-if="!hideHeader" class="priority-editor__header">
      <div class="priority-editor__label-row">
        <span class="settings-field__label">{{ label }}</span>
      </div>
      <span v-if="hint || $slots.hint" class="priority-editor__hint">
        <slot name="hint">{{ hint }}</slot>
      </span>
    </div>

    <div class="priority-editor__list pill-list-editor__list" @dragover.prevent @drop.prevent="onListDrop">
      <span
        v-for="(item, index) in items"
        :key="item.id"
        class="ui-chip priority-editor__item pill-list-editor__item"
        :class="{
          'pill-list-editor__item--error': item.error,
          'pill-list-editor__item--removable': item.removable !== false,
          'priority-editor__item--dragover': isDragOver(index)
        }"
        :draggable="sortable"
        @dragstart.self="onDragStart(index, $event)"
        @dragenter.self.prevent="onDragEnter(index)"
        @dragover.self.prevent
        @drop.self.prevent.stop="onDrop(index)"
        @dragleave.self="onDragLeave(index)"
        @dragend.self="onDragEnd"
      >
        <span
          class="pill-list-editor__display"
          :data-testid="`${displayTestIdPrefix}-${item.id}`"
          :title="item.title ?? item.label"
          :draggable="sortable"
          @dragstart="onDragStart(index, $event)"
          @dragenter.prevent="onDragEnter(index)"
          @dragover.prevent
          @drop.prevent.stop="onDrop(index)"
          @dragleave="onDragLeave(index)"
          @dragend="onDragEnd"
        >
          {{ item.label }}
        </span>

        <UiIconButton
          v-if="item.removable !== false"
          class="pill-list-editor__remove"
          size="sm"
          variant="ghost"
          :label="removeLabel"
          :data-testid="`${removeTestIdPrefix}-${item.id}`"
          @click.stop="$emit('remove', item.id)"
        >
          <IconClose size="sm" />
        </UiIconButton>
      </span>

      <span class="priority-editor__item priority-editor__draft pill-list-editor__draft">
        <span class="pill-list-editor__draft-sizer" aria-hidden="true">{{ draftSizerText }}</span>
        <UiInput
          class="priority-editor__draft-input pill-list-editor__input"
          :data-testid="draftTestId"
          :model-value="draftValue"
          :placeholder="placeholder"
          @update:model-value="$emit('update:draftValue', String($event))"
          @blur="$emit('add-draft')"
          @keyup.enter="$emit('add-draft')"
        />
      </span>
    </div>

    <div v-if="error" class="settings-field__error">{{ error }}</div>
    <slot name="after-errors" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { IconClose } from "../icons";
import { UiIconButton, UiInput } from "../ui";
import type { PillListEditorItem } from "./pillListEditorTypes";

const props = withDefaults(
  defineProps<{
    label: string;
    hint?: string;
    items: PillListEditorItem[];
    draftValue: string;
    placeholder: string;
    removeLabel: string;
    error?: string | null;
    sortable?: boolean;
    hideHeader?: boolean;
    draftTestId: string;
    displayTestIdPrefix: string;
    removeTestIdPrefix: string;
  }>(),
  {
    hint: "",
    error: null,
    sortable: false,
    hideHeader: false
  }
);

const emit = defineEmits<{
  (event: "update:draftValue", value: string): void;
  (event: "add-draft"): void;
  (event: "remove", id: string): void;
  (event: "reorder", fromIndex: number, toIndex: number): void;
}>();

const dragState = ref<{ fromIndex: number | null; overIndex: number | null }>({
  fromIndex: null,
  overIndex: null
});
const draftSizerText = computed(() => props.draftValue || props.placeholder || " ");

function resetDragState() {
  dragState.value = { fromIndex: null, overIndex: null };
}

function onDragStart(index: number, event: DragEvent) {
  if (!props.sortable) {
    return;
  }
  dragState.value = { fromIndex: index, overIndex: index };
  event.dataTransfer?.setData("text/plain", String(index));
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
}

function onDragEnter(index: number) {
  if (!props.sortable || dragState.value.fromIndex === null) {
    return;
  }
  dragState.value.overIndex = index;
}

function onDragLeave(index: number) {
  if (dragState.value.overIndex === index) {
    dragState.value.overIndex = null;
  }
}

function onDrop(index: number) {
  const fromIndex = dragState.value.fromIndex;
  if (!props.sortable || fromIndex === null) {
    resetDragState();
    return;
  }
  if (fromIndex !== index) {
    emit("reorder", fromIndex, index);
  }
  resetDragState();
}

function onListDrop() {
  const fromIndex = dragState.value.fromIndex;
  const overIndex = dragState.value.overIndex;
  if (!props.sortable || fromIndex === null || overIndex === null) {
    resetDragState();
    return;
  }
  if (fromIndex !== overIndex) {
    emit("reorder", fromIndex, overIndex);
  }
  resetDragState();
}

function onDragEnd() {
  resetDragState();
}

function isDragOver(index: number) {
  return props.sortable && dragState.value.overIndex === index && dragState.value.fromIndex !== index;
}
</script>
