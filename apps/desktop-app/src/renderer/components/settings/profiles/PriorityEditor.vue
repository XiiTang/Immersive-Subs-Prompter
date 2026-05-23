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
      <template v-if="hintLinkParts">
        {{ hintLinkParts.before }}<a
          class="priority-editor__hint-link"
          :href="docUrl ?? undefined"
          @click.prevent="onDocLinkClick"
        >{{ hintLinkParts.linked }}</a>{{ hintLinkParts.after }}
      </template>
      <template v-else>{{ hint }}</template>
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
  docUrl?: string | null;
  removeLabel: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "add"): void;
  (e: "remove", value: string): void;
  (e: "reorder", fromIndex: number, toIndex: number): void;
  (e: "doc-link-click"): void;
}>();

const pillItems = computed<PillListEditorItem[]>(() =>
  props.items.map((item) => ({
    id: item,
    label: item,
    title: item
  }))
);

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

function onRemove(value: string) {
  emit("remove", value);
}

function onDocLinkClick() {
  emit("doc-link-click");
}
</script>
