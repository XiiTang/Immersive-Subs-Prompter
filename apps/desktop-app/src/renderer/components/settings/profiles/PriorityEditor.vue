<template>
  <PillListEditor
    class="priority-editor"
    :label="label"
    :items="pillItems"
    :draft-value="modelValue"
    :placeholder="placeholder"
    :remove-label="removeLabel"
    :error="error"
    :sortable="true"
    draft-test-id="priority-draft-input"
    :display-test-id-prefix="`priority-${role}-display`"
    :remove-test-id-prefix="`priority-${role}-remove`"
    @update:draft-value="onInputValue"
    @add-draft="$emit('add')"
    @remove="onRemove"
    @reorder="(fromIndex, toIndex) => $emit('reorder', fromIndex, toIndex)"
  >
    <template #hint>
      {{ hint }}
    </template>
  </PillListEditor>
</template>

<script setup lang="ts">
import { computed } from "vue";
import PillListEditor from "../PillListEditor.vue";
import type { PillListEditorItem } from "../pillListEditorTypes";

type PriorityRole = "primary" | "secondary";

interface Props {
  role: PriorityRole;
  items: readonly string[];
  modelValue: string;
  label: string;
  hint: string;
  placeholder: string;
  error: string | null;
  removeLabel: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "add"): void;
  (e: "remove", value: string): void;
  (e: "reorder", fromIndex: number, toIndex: number): void;
}>();

const pillItems = computed<PillListEditorItem[]>(() =>
  props.items.map((item) => ({
    id: item,
    label: item,
    title: item
  }))
);

function onInputValue(value: string | number) {
  emit("update:modelValue", String(value));
}

function onRemove(value: string) {
  emit("remove", value);
}
</script>
