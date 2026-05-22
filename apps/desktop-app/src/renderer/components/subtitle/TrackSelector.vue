<template>
  <label class="track-picker" :class="{ 'track-picker--grow': grow }">
    <UiSelect :model-value="modelValue" :options="options" :aria-label="ariaLabel" @update:model-value="$emit('update:modelValue', $event)" />
  </label>
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

defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const options = computed(() => [
  ...(leadLabel ? [{ value: "", label: leadLabel, disabled: true }] : []),
  ...(noneLabel ? [{ value: "", label: noneLabel }] : []),
  ...tracks.map((track) => ({ value: track.id, label: formatSourceFile(track.sourceFile) }))
]);
</script>
