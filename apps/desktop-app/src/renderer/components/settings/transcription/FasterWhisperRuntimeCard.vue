<template>
  <section class="fw-runtime">
    <UiSettingRow id="feature-transcription-fw-binary" :label="t('feature-transcription-fw-binary')" control-width="wide">
      <UiInput
        :model-value="activeConfig.fasterWhisperBinary"
        @update:model-value="$emit('update:config', { fasterWhisperBinary: String($event) })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-downloaded-model" :label="t('feature-transcription-downloaded-model')" control-width="field">
      <UiSelect
        :model-value="selectedDownloadedModel"
        :options="downloadedModelOptions"
        @update:model-value="selectDownloadedModel(String($event))"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-model" :label="t('feature-transcription-faster-whisper-model')" control-width="field">
      <UiInput
        :model-value="customModelInput || activeConfig.fasterWhisperModel"
        @update:model-value="updateCustomModel(String($event))"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-model-dir" :label="t('feature-transcription-model-directory')" control-width="wide">
      <UiInput
        :model-value="activeConfig.fasterWhisperModelDir"
        @update:model-value="$emit('update:config', { fasterWhisperModelDir: String($event) })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-device" :label="t('feature-transcription-device')" control-width="field">
      <UiSelect
        :model-value="activeConfig.fasterWhisperDevice"
        :options="deviceOptions"
        @update:model-value="$emit('update:config', { fasterWhisperDevice: $event as 'cpu' | 'cuda' })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-language" :label="t('feature-transcription-language')" control-width="field">
      <UiInput
        :model-value="activeConfig.language"
        @update:model-value="$emit('update:config', { language: String($event) })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-prompt" :label="t('feature-transcription-prompt')" control-width="editor" stacked>
      <UiTextarea
        :model-value="activeConfig.prompt"
        :rows="3"
        @update:model-value="$emit('update:config', { prompt: $event })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-vad-filter" :label="t('feature-transcription-vad-filter')" control-width="compact">
      <UiSwitch
        :model-value="activeConfig.fasterWhisperVadFilter"
        :label="t('feature-transcription-vad-filter')"
        @update:model-value="$emit('update:config', { fasterWhisperVadFilter: $event })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-vad-threshold" :label="t('feature-transcription-vad-threshold')" control-width="compact">
      <UiInput
        :model-value="vadThresholdDraft"
        type="number"
        min="0"
        max="1"
        step="0.01"
        @update:model-value="updateVadThresholdDraft(String($event))"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-vad-method" :label="t('feature-transcription-vad-method')" control-width="field">
      <UiInput
        :model-value="activeConfig.fasterWhisperVadMethod"
        @update:model-value="$emit('update:config', { fasterWhisperVadMethod: String($event) })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-kim2" :label="t('feature-transcription-kim2')" control-width="compact">
      <UiSwitch
        :model-value="activeConfig.fasterWhisperUseKim2"
        :label="t('feature-transcription-kim2')"
        @update:model-value="$emit('update:config', { fasterWhisperUseKim2: $event })"
      />
    </UiSettingRow>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { TranscriptionConfig } from "../../../../main/types";
import { UiInput, UiSelect, UiSettingRow, UiSwitch, UiTextarea } from "../../ui";
import { parseBoundedNumberDraft } from "../numericDraft";

const props = defineProps<{
  t: (key: string) => string;
  activeConfig: TranscriptionConfig;
  availableModels: Array<{ name: string; path: string; folder: string }>;
  modelsBaseDir: string;
  selectedDownloadedModel: string;
  customModelInput: string;
}>();

const emit = defineEmits<{
  "update:selectedDownloadedModel": [value: string];
  "update:customModelInput": [value: string];
  "update:config": [patch: Partial<TranscriptionConfig>];
}>();

const deviceOptions = [
  { value: "cpu", label: "CPU" },
  { value: "cuda", label: "CUDA" }
];

const downloadedModelOptions = computed(() => [
  { value: "", label: props.t("feature-transcription-custom-model") },
  ...props.availableModels.map((model) => ({ value: model.name, label: model.name }))
]);
const vadThresholdDraft = ref("");

function selectDownloadedModel(value: string) {
  emit("update:selectedDownloadedModel", value);
  if (value) {
    emit("update:customModelInput", "");
    emit("update:config", {
      fasterWhisperModel: value,
      fasterWhisperModelDir: props.modelsBaseDir
    });
  }
}

function updateCustomModel(value: string) {
  emit("update:customModelInput", value);
  if (value) {
    emit("update:selectedDownloadedModel", "");
  }
  emit("update:config", { fasterWhisperModel: value });
}

function updateVadThresholdDraft(value: string) {
  vadThresholdDraft.value = value;
  const threshold = parseBoundedNumberDraft(value, 0, 1);
  if (threshold !== null) {
    emit("update:config", { fasterWhisperVadThreshold: threshold });
  }
}

watch(
  () => [props.activeConfig.id, props.activeConfig.fasterWhisperVadThreshold] as const,
  ([, threshold]) => {
    vadThresholdDraft.value = String(threshold);
  },
  { immediate: true }
);
</script>

<style scoped>
.fw-runtime {
  display: contents;
}
</style>
