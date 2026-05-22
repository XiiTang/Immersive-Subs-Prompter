<template>
  <section class="ui-group">
    <header class="ui-group__header">
      <h3 class="ui-group__title">{{ t("transcription-faster-models-available", "AI Models") }}</h3>
    </header>

    <div class="ui-group__body">
      <div class="settings-model-row">
        <template v-if="availableModels.length">
          <UiBadge v-for="m in availableModels" :key="m.path">
            {{ m.name }}
          </UiBadge>
        </template>
        <UiEmptyState v-else :message="t('transcription-faster-model-missing', 'No downloaded models detected')" />
        <div class="settings-inline settings-inline--end">
          <UiSelect
            v-model="selectedModel"
            :options="fasterWhisperModels"
            :aria-label="t('transcription-faster-download-model-label', 'Model to download')"
          />
          <UiButton variant="primary" :disabled="isBusy" @click="$emit('download-model')">
            {{ t("transcription-faster-download-model", "Download") }}
          </UiButton>
        </div>
      </div>

      <div class="settings-field-stack">
        <div class="settings-row settings-row--between">
          <span class="ui-field__label">{{ t("transcription-faster-model-dir", "Model Path (Optional)") }}</span>
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
  </section>
</template>

<script setup lang="ts">
import { IconFolder } from "../../icons";
import type { AvailableModel } from "./composables/useFasterWhisper";
import { UiBadge, UiButton, UiEmptyState, UiIconButton, UiInput, UiSelect } from "../../ui";

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
