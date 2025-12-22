<template>
  <label class="track-picker" :class="{ 'track-picker--grow': grow }">
    <select :value="modelValue" :aria-label="ariaLabel" @change="handleChange">
      <option v-if="placeholder" disabled value="">{{ placeholder }}</option>
      <option v-if="noneLabel" value="">{{ noneLabel }}</option>
      <option v-for="track in tracks" :key="track.id" :value="track.id">
        {{ formatSourceFile(track.sourceFile) }}
      </option>
    </select>
  </label>
</template>

<script setup lang="ts">
interface SubtitleTrackOption {
  id: string;
  sourceFile: string;
}

const props = defineProps<{
  modelValue: string;
  tracks: SubtitleTrackOption[];
  placeholder?: string;
  noneLabel?: string;
  ariaLabel?: string;
  grow?: boolean;
  formatSourceFile: (sourceFile: string) => string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement | null;
  emit("update:modelValue", target?.value ?? "");
}
</script>
