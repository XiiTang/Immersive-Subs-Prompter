<template>
  <div class="transcription-controls">
    <label class="track-picker transcription-picker">
      <select
        :value="activeId"
        :title="t('transcription-config-select', 'Transcription Config')"
        @change="handleConfigChange"
      >
        <option v-for="config in configs" :key="config.id" :value="config.id">
          {{ config.name || config.id }}
        </option>
      </select>
    </label>
    <button
      class="icon-button transcription-btn"
      type="button"
      :disabled="!canTranscribe || isTranscribing"
      :title="
        isTranscribing
          ? t('transcription-button-running', 'Transcribing...')
          : t('transcription-button-start', 'Start Transcription')
      "
      @click="$emit('start')"
    >
      <span aria-hidden="true">{{ isTranscribing ? "⏳" : "▶" }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
const {
  configs,
  activeId,
  canTranscribe,
  isTranscribing,
  t
} = defineProps<{
  configs: any[];
  activeId: string;
  canTranscribe: boolean;
  isTranscribing: boolean;
  t: (key: string, fallback?: string, params?: Record<string, any>) => string;
}>();

const emit = defineEmits<{
  (e: "update:activeId", value: string): void;
  (e: "start"): void;
}>();

function handleConfigChange(event: Event) {
  const target = event.target as HTMLSelectElement | null;
  emit("update:activeId", target?.value ?? "");
}
</script>
