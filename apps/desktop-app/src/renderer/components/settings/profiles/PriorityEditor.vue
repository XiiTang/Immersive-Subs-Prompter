<template>
  <div class="priority-editor">
    <div class="priority-editor__header">
      <div class="priority-editor__label-row">
        <span class="settings-field__label">{{ label }}</span>
        <a
          v-if="docUrl"
          class="priority-editor__link"
          :href="docUrl"
          @click.prevent="onDocLinkClick"
        >
          {{ docLinkText }}
        </a>
      </div>
      <span class="priority-editor__hint">{{ hint }}</span>
    </div>
    <div
      class="priority-editor__list"
      @dragover.prevent
      @drop.prevent="onListDrop(role)"
    >
      <template v-if="items.length">
        <span
          v-for="(item, index) in items"
          :key="item"
          class="ui-chip priority-editor__item"
          :class="{ 'priority-editor__item--dragover': isDragOver(role, index) }"
          draggable="true"
          @dragstart="onDragStart(role, index, $event)"
          @dragenter.prevent="onDragEnter(role, index)"
          @dragover.prevent
          @drop.prevent.stop="onDrop(role, index)"
          @dragleave="onDragLeave(role, index)"
          @dragend="onDragEnd"
        >
          <span>{{ item }}</span>
          <UiIconButton
            class="ui-chip__remove"
            size="sm"
            variant="ghost"
            :aria-label="removeLabel"
            :label="removeLabel"
            @click="$emit('remove', item)"
          >
            <IconDelete size="sm" />
          </UiIconButton>
        </span>
      </template>
      <UiEmptyState v-else :message="emptyText" />
    </div>
    <div class="priority-editor__controls">
      <UiInput
        :model-value="modelValue"
        :placeholder="placeholder"
        @update:model-value="onInputValue"
        @keyup.enter="$emit('add')"
      />
      <UiIconButton :label="addButtonLabel" @click="$emit('add')">
        <IconAdd size="md" />
      </UiIconButton>
    </div>
    <div v-if="error" class="settings-field__error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { IconAdd, IconDelete } from "../../icons";
import type { PriorityRole } from "./composables/usePriorityDragDrop";
import { UiEmptyState, UiIconButton, UiInput } from "../../ui";

interface Props {
  role: PriorityRole;
  items: readonly string[];
  modelValue: string;
  label: string;
  hint: string;
  placeholder: string;
  emptyText: string;
  addButtonLabel: string;
  removeLabel: string;
  error: string | null;
  docUrl?: string | null;
  docLinkText?: string;
  isDragOver: (role: PriorityRole, index: number) => boolean;
  onDragStart: (role: PriorityRole, index: number, event: DragEvent) => void;
  onDragEnter: (role: PriorityRole, index: number) => void;
  onDragLeave: (role: PriorityRole, index: number) => void;
  onDrop: (role: PriorityRole, index: number) => void;
  onDragEnd: () => void;
  onListDrop: (role: PriorityRole) => void;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "add"): void;
  (e: "remove", value: string): void;
  (e: "doc-link-click"): void;
}>();

function onInputValue(value: string | number) {
  emit("update:modelValue", String(value));
}

function onDocLinkClick() {
  emit("doc-link-click");
}
</script>
