<template>
  <div class="settings-split__sidebar">
    <div class="settings-split__sidebar-header">
      <span class="settings-field__label">{{ t("transcription-active-config", "Active Config") }}</span>
      <div class="settings-split__sidebar-buttons">
        <UiIconButton :label="t('button-add', 'Add')" @click="$emit('add')">
          <IconAdd size="md" />
        </UiIconButton>
        <UiIconButton
          :disabled="transcriptionConfigs.length <= 1"
          variant="danger"
          :label="t('button-delete', 'Delete')"
          @click="$emit('delete')"
        >
          <IconDelete size="md" />
        </UiIconButton>
      </div>
    </div>
    <div class="transcription-config-list ui-list">
      <template v-if="transcriptionConfigs.length">
        <UiListItem
          v-for="config in transcriptionConfigs"
          :key="config.id"
          as="button"
          class="transcription-config-list__item"
          :selected="config.id === activeConfigId"
          @click="$emit('select', config.id)"
        >
          <div class="transcription-config-list__name">
            <span class="transcription-config-list__label">{{ config.name || config.id }}</span>
            <UiBadge v-if="config.id === activeConfigId" tone="info">
              {{ t("transcription-config-active-badge", "Active") }}
            </UiBadge>
          </div>
          <div class="transcription-config-list__meta">
            <UiBadge>
              {{ getProviderLabel(config.provider) }}
            </UiBadge>
            <span class="transcription-config-list__muted">
              {{ getModelLabel(config) }}
            </span>
          </div>
        </UiListItem>
      </template>
      <UiEmptyState v-else :message="t('transcription-config-empty', 'No transcription configs yet')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TranscriptionConfig } from "../../../../main/types";
import { IconAdd, IconDelete } from "../../icons";
import { UiBadge, UiEmptyState, UiIconButton, UiListItem } from "../../ui";

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
