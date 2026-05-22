<template>
  <div class="track-picker" :class="{ 'track-picker--grow': grow }">
    <UiSelect
      :model-value="selectValue"
      :options="options"
      :aria-label="ariaLabel"
      @update:model-value="handleSelectValue"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { UiSelect } from "../ui";

interface SubtitleTrackOption {
  id: string;
  sourceFile: string;
}

const {
  modelValue,
  tracks,
  leadLabel,
  noneLabel,
  ariaLabel,
  grow,
  formatSourceFile
} = defineProps<{
  modelValue: string;
  tracks: SubtitleTrackOption[];
  leadLabel?: string;
  noneLabel?: string;
  ariaLabel?: string;
  grow?: boolean;
  formatSourceFile: (sourceFile: string) => string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const LEAD_LABEL_VALUE = "__track_selector_lead_label__";
const NO_TRACK_VALUE = "__track_selector_none__";
const selectValue = computed(() => (modelValue === "" ? NO_TRACK_VALUE : modelValue));
const options = computed(() => [
  ...(leadLabel ? [{ value: LEAD_LABEL_VALUE, label: leadLabel, disabled: true }] : []),
  ...(noneLabel ? [{ value: NO_TRACK_VALUE, label: noneLabel }] : []),
  ...tracks.map((track) => ({ value: track.id, label: formatSourceFile(track.sourceFile) }))
]);

function handleSelectValue(value: string) {
  if (value === LEAD_LABEL_VALUE) {
    return;
  }
  emit("update:modelValue", value === NO_TRACK_VALUE ? "" : value);
}
</script>
