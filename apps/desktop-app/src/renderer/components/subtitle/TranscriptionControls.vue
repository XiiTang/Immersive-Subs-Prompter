<template>
  <div class="transcription-controls">
    <div class="track-picker transcription-picker">
      <UiSelect
        :model-value="activeId"
        :options="configOptions"
        :aria-label="t('transcription-config-select')"
        @update:model-value="$emit('update:activeId', $event)"
      />
    </div>
    <UiIconButton
      class="transcription-btn"
      :disabled="!canTranscribe || isTranscribing"
      :label="
        isTranscribing
          ? t('transcription-button-running')
          : t('transcription-button-start')
      "
      @click="$emit('start')"
    >
      <IconRefresh v-if="isTranscribing" size="md" class="icon--spinning" />
      <IconPlay v-else size="md" />
    </UiIconButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { IconPlay, IconRefresh } from "../icons";
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
  t: (key: string, params?: Record<string, any>) => string;
}>();

defineEmits<{
  (e: "update:activeId", value: string): void;
  (e: "start"): void;
}>();

const configOptions = computed(() => configs.map((config) => ({ value: config.id, label: config.name || config.id })));
</script>
