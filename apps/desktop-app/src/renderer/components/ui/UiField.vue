<template>
  <label class="ui-field" :class="{ 'ui-field--inline': inline }">
    <span class="ui-field__label-row">
      <span class="ui-field__label">{{ label }}</span>
      <span v-if="value" class="ui-field__value">{{ value }}</span>
    </span>
    <span class="ui-field__control" :aria-describedby="describedBy || undefined">
      <slot />
    </span>
    <span v-if="hint" :id="`${id}-hint`" class="ui-field__hint">{{ hint }}</span>
    <span v-if="error" :id="`${id}-error`" class="ui-field__error">{{ error }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed } from "vue";

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
</script>
