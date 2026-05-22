<template>
  <div class="fw-card">
    <div class="fw-card__header">
      <div class="fw-card__title">{{ t("transcription-faster-models-available", "AI Models") }}</div>
    </div>

    <div class="fw-card__content">
      <div class="fw-model-row">
        <template v-if="availableModels.length">
          <span v-for="m in availableModels" :key="m.path" class="fw-model-chip">
            {{ m.name }}
          </span>
        </template>
        <span v-else class="fw-model-empty-hint">
          {{ t("transcription-faster-model-missing", "No downloaded models detected") }}
        </span>
        <div class="fw-model-download">
          <UiSelect v-model="selectedModel" :options="fasterWhisperModels" />
          <UiButton variant="primary" :disabled="isBusy" @click="$emit('download-model')">
            {{ t("transcription-faster-download-model", "Download") }}
          </UiButton>
        </div>
      </div>

      <div class="fw-folder-input">
        <div class="fw-field-header">
          <span class="label">{{ t("transcription-faster-model-dir", "Model Path (Optional)") }}</span>
          <UiIconButton
            size="sm"
            @click="$emit('open-path', modelsDir)"
            :label="t('transcription-faster-open-models', 'Open folder')"
          >
            <IconFolder size="sm" />
          </UiIconButton>
        </div>
        <UiInput v-model="fasterWhisperModelDir" placeholder="~/models/faster-whisper" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { IconFolder } from "../../icons";
import type { AvailableModel } from "./composables/useFasterWhisper";
import { UiButton, UiIconButton, UiInput, UiSelect } from "../../ui";

defineProps<{
  t: (key: string, fallback: string) => string;
  availableModels: AvailableModel[];
  isBusy: boolean;
  modelsDir: string | undefined;
}>();

defineEmits<{
  (event: "download-model"): void;
  (event: "open-path", target: string | undefined): void;
}>();

const fasterWhisperModels = [
  { label: "tiny", value: "tiny" },
  { label: "base", value: "base" },
  { label: "small", value: "small" },
  { label: "medium", value: "medium" },
  { label: "large-v1", value: "large-v1" },
  { label: "large-v2", value: "large-v2" },
  { label: "large-v3", value: "large-v3" },
  { label: "large-v3-turbo", value: "large-v3-turbo" }
];

const selectedModel = defineModel<string>("selectedModel", { required: true });
const fasterWhisperModelDir = defineModel<string>("fasterWhisperModelDir", { required: true });
</script>
