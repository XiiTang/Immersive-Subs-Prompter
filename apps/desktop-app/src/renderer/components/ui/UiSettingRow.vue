<template>
  <div
    :id="id"
    class="ui-setting-row"
    :class="[`ui-setting-row--${controlWidth}`, { 'ui-setting-row--stacked': stacked }]"
    data-slot="setting-row"
  >
    <div class="ui-setting-row__meta">
      <span :id="labelId" class="ui-setting-row__label">{{ label }}</span>
      <span v-if="hint" :id="hintId" class="ui-setting-row__hint">{{ hint }}</span>
      <span v-if="value" class="ui-setting-row__value">{{ value }}</span>
    </div>
    <div class="ui-setting-row__control" :aria-describedby="describedBy || undefined">
      <slot />
    </div>
    <span v-if="error" :id="errorId" class="ui-setting-row__error">{{ error }}</span>
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
    value?: string;
    error?: string | null;
    controlWidth?: "compact" | "field" | "wide" | "editor" | "stats";
    stacked?: boolean;
  }>(),
  {
    hint: "",
    value: "",
    error: null,
    controlWidth: "field",
    stacked: false
  }
);

const labelId = computed(() => `${props.id}-label`);
const hintId = computed(() => `${props.id}-hint`);
const errorId = computed(() => `${props.id}-error`);
const describedBy = computed(() =>
  [props.hint ? hintId.value : "", props.error ? errorId.value : ""].filter(Boolean).join(" ")
);

provide(uiFieldContextKey, {
  labelId,
  describedBy
});
</script>
