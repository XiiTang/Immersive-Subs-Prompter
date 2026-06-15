<template>
  <div class="feature-settings">
    <UiSettingRow id="feature-transcription-provider" :label="t('feature-transcription-provider')" control-width="field">
      <UiSelect
        :model-value="config.provider"
        :options="providerOptions"
        @update:model-value="update({ provider: $event as 'whisper-api' | 'faster-whisper' })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-base-url" :label="t('feature-transcription-base-url')" control-width="wide">
      <UiInput :model-value="config.baseUrl" @update:model-value="update({ baseUrl: String($event) })" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-api-key" :label="t('feature-transcription-api-key')" control-width="wide">
      <UiInput :model-value="config.apiKey" type="password" @update:model-value="update({ apiKey: String($event) })" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-model" :label="t('feature-transcription-model')" control-width="field">
      <UiInput :model-value="config.model" @update:model-value="update({ model: String($event) })" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-language" :label="t('feature-transcription-language')" control-width="field">
      <UiInput :model-value="config.language" @update:model-value="update({ language: String($event) })" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-prompt" :label="t('feature-transcription-prompt')" control-width="editor" stacked>
      <UiTextarea :model-value="config.prompt" :rows="3" @update:model-value="update({ prompt: $event })" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-word-timestamps" :label="t('feature-transcription-word-timestamps')" control-width="compact">
      <UiSwitch
        :model-value="config.enableWordTimestamps"
        :label="t('feature-transcription-word-timestamps')"
        @update:model-value="update({ enableWordTimestamps: $event })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-extra-params" :label="t('feature-transcription-extra-params')" control-width="editor" stacked>
      <UiTextarea
        :model-value="config.extraParamsJson"
        :rows="4"
        @update:model-value="update({ extraParamsJson: $event })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-model" :label="t('feature-transcription-faster-whisper-model')" control-width="field">
      <UiInput :model-value="config.fasterWhisperModel" @update:model-value="update({ fasterWhisperModel: String($event) })" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-model-dir" :label="t('feature-transcription-model-directory')" control-width="wide">
      <UiInput :model-value="config.fasterWhisperModelDir" @update:model-value="update({ fasterWhisperModelDir: String($event) })" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-device" :label="t('feature-transcription-device')" control-width="field">
      <UiSelect
        :model-value="config.fasterWhisperDevice"
        :options="deviceOptions"
        @update:model-value="update({ fasterWhisperDevice: $event as 'cpu' | 'cuda' })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-vad-filter" :label="t('feature-transcription-vad-filter')" control-width="compact">
      <UiSwitch
        :model-value="config.fasterWhisperVadFilter"
        :label="t('feature-transcription-vad-filter')"
        @update:model-value="update({ fasterWhisperVadFilter: $event })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-vad-threshold" :label="t('feature-transcription-vad-threshold')" control-width="compact">
      <UiInput
        :model-value="config.fasterWhisperVadThreshold"
        type="number"
        min="0"
        max="1"
        step="0.01"
        @update:model-value="update({ fasterWhisperVadThreshold: Number($event) })"
      />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-vad-method" :label="t('feature-transcription-vad-method')" control-width="field">
      <UiInput :model-value="config.fasterWhisperVadMethod" @update:model-value="update({ fasterWhisperVadMethod: String($event) })" />
    </UiSettingRow>
    <UiSettingRow id="feature-transcription-fw-kim2" :label="t('feature-transcription-kim2')" control-width="compact">
      <UiSwitch
        :model-value="config.fasterWhisperUseKim2"
        :label="t('feature-transcription-kim2')"
        @update:model-value="update({ fasterWhisperUseKim2: $event })"
      />
    </UiSettingRow>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TranscriptionFeatureConfig } from "../../../main/types";
import { DEFAULT_FEATURE_SETTINGS } from "../../../common/featureDefaults";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { UiInput, UiSelect, UiSettingRow, UiSwitch, UiTextarea } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const config = computed(() => store.settings?.features.transcription.config ?? DEFAULT_FEATURE_SETTINGS.transcription.config);
const providerOptions = [
  { value: "whisper-api", label: "Whisper API" },
  { value: "faster-whisper", label: "Faster-Whisper" }
];
const deviceOptions = [
  { value: "cpu", label: "CPU" },
  { value: "cuda", label: "CUDA" }
];

function update(patch: Partial<TranscriptionFeatureConfig>) {
  void store.setFeatureConfig("transcription", patch);
}
</script>

<style scoped>
.feature-settings {
  display: grid;
  gap: 10px;
}
</style>
