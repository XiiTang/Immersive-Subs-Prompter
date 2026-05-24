<template>
  <UiInput
    v-bind="attrs"
    :model-value="modelValue"
    :placeholder="placeholder"
    readonly
    @keydown="handleKeydown"
  />
</template>

<script setup lang="ts">
import { useAttrs } from "vue";
import { UiInput } from "../ui";

defineOptions({ inheritAttrs: false });

defineProps<{
  modelValue: string;
  placeholder: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const attrs = useAttrs();
const modifierKeys = new Set(["Alt", "Control", "Meta", "Shift"]);

const keyByCode: Record<string, string> = {
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  ArrowUp: "Up",
  Backspace: "Backspace",
  Delete: "Delete",
  End: "End",
  Enter: "Enter",
  Escape: "Esc",
  Home: "Home",
  Insert: "Insert",
  PageDown: "PageDown",
  PageUp: "PageUp",
  Space: "Space",
  Tab: "Tab"
};

function handleKeydown(event: KeyboardEvent) {
  event.preventDefault();
  event.stopPropagation();

  const key = acceleratorKey(event);
  const hasModifier = event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;

  if ((key === "Backspace" || key === "Delete") && !hasModifier) {
    emit("update:modelValue", "");
    return;
  }

  if (!key || modifierKeys.has(event.key)) {
    return;
  }

  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push("CommandOrControl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }
  parts.push(key);

  emit("update:modelValue", parts.join("+"));
}

function acceleratorKey(event: KeyboardEvent): string | null {
  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3);
  }
  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice(5);
  }
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(event.code)) {
    return event.code;
  }
  if (keyByCode[event.code]) {
    return keyByCode[event.code];
  }
  if (event.key.length === 1) {
    return event.key.toUpperCase();
  }
  return keyByCode[event.key] ?? null;
}
</script>
