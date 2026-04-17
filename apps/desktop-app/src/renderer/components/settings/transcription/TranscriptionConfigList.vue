<template>
  <div class="settings-split__sidebar">
    <div class="settings-split__sidebar-header">
      <span class="settings-field__label">{{ t("transcription-active-config", "Active Config") }}</span>
      <div class="settings-split__sidebar-buttons">
        <button
          type="button"
          class="icon-button"
          :title="t('button-add', 'Add')"
          :aria-label="t('button-add', 'Add')"
          @click="$emit('add')"
        >
          <IconAdd size="md" />
        </button>
        <button
          type="button"
          class="icon-button"
          :disabled="transcriptionConfigs.length <= 1"
          :title="t('button-delete', 'Delete')"
          :aria-label="t('button-delete', 'Delete')"
          @click="$emit('delete')"
        >
          <IconDelete size="md" />
        </button>
      </div>
    </div>
    <div class="transcription-config-list settings-list">
      <template v-if="transcriptionConfigs.length">
        <button
          v-for="config in transcriptionConfigs"
          :key="config.id"
          type="button"
          class="transcription-config-list__item"
          :class="{ 'is-selected': config.id === activeConfigId }"
          @click="$emit('select', config.id)"
        >
          <div class="transcription-config-list__name">
            <span class="transcription-config-list__label">{{ config.name || config.id }}</span>
            <span v-if="config.id === activeConfigId" class="transcription-config-list__badge">
              {{ t("transcription-config-active-badge", "Active") }}
            </span>
          </div>
          <div class="transcription-config-list__meta">
            <span class="transcription-config-list__pill">
              {{ getProviderLabel(config.provider) }}
            </span>
            <span class="transcription-config-list__muted">
              {{ getModelLabel(config) }}
            </span>
          </div>
        </button>
      </template>
      <div v-else class="transcription-config-list__empty">
        {{ t("transcription-config-empty", "No transcription configs yet") }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TranscriptionConfig } from "../../../../main/types";
import { IconAdd, IconDelete } from "../../icons";

const props = defineProps<{
  transcriptionConfigs: TranscriptionConfig[];
  activeConfigId: string;
  t: (key: string, fallback: string) => string;
}>();

defineEmits<{
  (event: "add"): void;
  (event: "delete"): void;
  (event: "select", id: string): void;
}>();

function getProviderLabel(provider: TranscriptionConfig["provider"] | undefined) {
  if (provider === "faster-whisper") {
    return props.t("transcription-provider-faster-short", "Faster-Whisper");
  }
  return props.t("transcription-provider-whisper-short", "Whisper API");
}

function getModelLabel(config: TranscriptionConfig) {
  const languageLabel = (config.language || "auto").trim() || "auto";
  if (config.provider === "faster-whisper") {
    const modelName = (config.fasterWhisperModel || props.t("transcription-faster-model", "Model")).trim();
    return `${modelName} · ${languageLabel}`;
  }
  const modelName = (config.model || props.t("transcription-model-label", "Model")).trim();
  return `${modelName} · ${languageLabel}`;
}
</script>
