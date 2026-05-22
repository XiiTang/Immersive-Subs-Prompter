<template>
  <div class="transcription-controls">
    <label class="track-picker transcription-picker">
      <UiSelect
        :model-value="activeId"
        :options="configOptions"
        :aria-label="t('transcription-config-select', 'Transcription Config')"
        @update:model-value="$emit('update:activeId', $event)"
      />
    </label>
    <UiIconButton
      class="transcription-btn"
      :disabled="!canTranscribe || isTranscribing"
      :label="
        isTranscribing
          ? t('transcription-button-running', 'Transcribing...')
          : t('transcription-button-start', 'Start Transcription')
      "
      @click="$emit('start')"
    >
      <span aria-hidden="true">{{ isTranscribing ? "⏳" : "▶" }}</span>
    </UiIconButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { UiIconButton, UiSelect } from "../ui";

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

defineEmits<{
  (e: "update:activeId", value: string): void;
  (e: "start"): void;
}>();

const configOptions = computed(() => configs.map((config) => ({ value: config.id, label: config.name || config.id })));
</script>
