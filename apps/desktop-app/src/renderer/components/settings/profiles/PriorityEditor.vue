<template>
  <div class="priority-editor">
    <div class="priority-editor__header">
      <div class="priority-editor__label-row">
        <span class="settings-field__label">{{ label }}</span>
      </div>
      <span class="priority-editor__hint">
        <template v-if="hintLinkParts">
          {{ hintLinkParts.before }}<a
            class="priority-editor__hint-link"
            :href="docUrl ?? undefined"
            @click.prevent="onDocLinkClick"
          >{{ hintLinkParts.linked }}</a>{{ hintLinkParts.after }}
        </template>
        <template v-else>{{ hint }}</template>
      </span>
    </div>
    <div
      class="priority-editor__list"
      @dragover.prevent
      @drop.prevent="onListDrop(role)"
    >
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
      </span>
      <span class="priority-editor__item priority-editor__draft">
        <UiInput
          class="priority-editor__draft-input"
          data-testid="priority-draft-input"
          :model-value="modelValue"
          :placeholder="placeholder"
          @update:model-value="onInputValue"
          @blur="$emit('add')"
          @keyup.enter="$emit('add')"
        />
      </span>
    </div>
    <div v-if="error" class="settings-field__error">{{ error }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PriorityRole } from "./composables/usePriorityDragDrop";
import { UiInput } from "../../ui";

interface Props {
  role: PriorityRole;
  items: readonly string[];
  modelValue: string;
  label: string;
  hint: string;
  placeholder: string;
  error: string | null;
  docUrl?: string | null;
  isDragOver: (role: PriorityRole, index: number) => boolean;
  onDragStart: (role: PriorityRole, index: number, event: DragEvent) => void;
  onDragEnter: (role: PriorityRole, index: number) => void;
  onDragLeave: (role: PriorityRole, index: number) => void;
  onDrop: (role: PriorityRole, index: number) => void;
  onDragEnd: () => void;
  onListDrop: (role: PriorityRole) => void;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "add"): void;
  (e: "doc-link-click"): void;
}>();

const hintLinkParts = computed(() => {
  if (!props.docUrl) {
    return null;
  }
  const linkTerms = ["正则表达式", "regular expressions"];
  for (const linked of linkTerms) {
    const start = props.hint.indexOf(linked);
    if (start >= 0) {
      return {
        before: props.hint.slice(0, start),
        linked,
        after: props.hint.slice(start + linked.length)
      };
    }
  }
  return null;
});

function onInputValue(value: string | number) {
  emit("update:modelValue", String(value));
}

function onDocLinkClick() {
  emit("doc-link-click");
}
</script>
