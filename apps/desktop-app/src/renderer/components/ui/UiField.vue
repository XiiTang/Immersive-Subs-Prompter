<template>
  <div class="ui-field" :class="{ 'ui-field--inline': inline }">
    <span class="ui-field__label-row">
      <span :id="labelId" class="ui-field__label">{{ label }}</span>
      <span v-if="value" class="ui-field__value">{{ value }}</span>
    </span>
    <div class="ui-field__control" :aria-describedby="describedBy || undefined">
      <slot />
    </div>
    <span v-if="hint" :id="`${id}-hint`" class="ui-field__hint">{{ hint }}</span>
    <span v-if="error" :id="`${id}-error`" class="ui-field__error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, provide } from "vue";
import { uiFieldContextKey } from "./fieldContext";

const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    hint?: string;
    error?: string | null;
    value?: string;
    inline?: boolean;
  }>(),
  {
    hint: "",
    error: null,
    value: "",
    inline: false
  }
);

const describedBy = computed(() =>
  [props.hint ? `${props.id}-hint` : "", props.error ? `${props.id}-error` : ""]
    .filter(Boolean)
    .join(" ")
);
const labelId = computed(() => `${props.id}-label`);

provide(uiFieldContextKey, {
  labelId,
  describedBy
});
</script>
