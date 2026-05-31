<template>
  <UiSection class="transcription-settings" :title="t('section-transcription')">
    <div class="settings-split transcription-settings__split">
      <TranscriptionConfigList
        :transcription-configs="transcriptionConfigs"
        :active-config-id="activeConfigId"
        :selected-config-id="selectedConfigId"
        :t="t"
        @add="handleAddConfig"
        @delete="handleDeleteConfig"
        @activate="(id) => (activeConfigId = id)"
        @rename="renameConfig"
        @select="(id) => (selectedConfigId = id)"
      />
      <div class="settings-split__editor transcription-settings__editor" v-if="selectedConfig">
        <UiField id="transcription-provider" :label="t('transcription-provider-label')">
          <UiSelect :model-value="provider" :options="providerOptions" @update:model-value="handleProviderInput" />
        </UiField>
        <template v-if="isWhisperApi">
          <WhisperApiForm
            :t="t"
            v-model:base-url="baseUrl"
            v-model:api-key="apiKey"
            v-model:model="model"
            v-model:language-field="languageField"
            v-model:prompt="prompt"
          />
        </template>
        <template v-else-if="isFasterWhisper">
          <div class="settings-stack transcription-settings__stack">
            <div v-if="downloadProgress" class="settings-progress">
              <div class="settings-progress__info">
                <span>{{ downloadProgress.status }}</span>
                <span>{{ downloadProgress.percent }}%</span>
              </div>
              <UiProgress :value="downloadProgress.percent" :label="t('transcription-download-progress')" />
            </div>

            <div class="settings-grid settings-grid--two transcription-settings__resource-grid">
              <FasterWhisperBinariesCard
                :t="t"
                :binary-status="binaryStatus"
                :binary-downloads-supported="binaryDownloadsSupported"
                :unsupported-reason="binaryDownloadUnsupportedReason"
                :is-busy="isBusy"
                :binary-dir="paths?.binaryDir"
                v-model:faster-whisper-binary="fasterWhisperBinary"
                @download-binary="handleDownloadBinary"
                @open-path="openPath"
              />
              <FasterWhisperModelsCard
                :t="t"
                :available-models="availableModels"
                :is-busy="isBusy"
                :models-dir="paths?.modelsDir"
                v-model:selected-model="selectedModel"
                v-model:faster-whisper-model-dir="fasterWhisperModelDir"
                @download-model="handleDownloadModel"
                @open-path="openPath"
              />
            </div>

            <FasterWhisperRuntimeCard
              :t="t"
              :available-models="availableModels"
              v-model:selected-downloaded-model="selectedDownloadedModel"
              v-model:custom-model-input="customModelInput"
              v-model:faster-whisper-device="fasterWhisperDevice"
              v-model:faster-whisper-vad-filter="fasterWhisperVadFilter"
              v-model:faster-whisper-vad-threshold="fasterWhisperVadThreshold"
              v-model:faster-whisper-vad-method="fasterWhisperVadMethod"
              v-model:faster-whisper-use-kim2="fasterWhisperUseKim2"
              v-model:language-field="languageField"
              v-model:prompt="prompt"
            />

            <p v-if="downloadMessage" class="ui-message ui-message--info">{{ downloadMessage }}</p>
            <p v-if="downloadError" class="ui-message ui-message--error">{{ downloadError }}</p>
          </div>
        </template>
        <UiField
          v-if="isWhisperApi"
          id="transcription-extra-params"
          :label="t('transcription-extra-params-label')"
          :hint="t('transcription-extra-params-hint')"
          :error="extraParamsError"
        >
          <UiTextarea v-model="extraParamsText" :rows="4" />
        </UiField>
        <UiField id="transcription-ytdlp" :label="t('transcription-ytdlp-label')" :hint="t('transcription-ytdlp-hint')">
          <UiInput v-model="ytDlpArgs" placeholder="--extract-audio --audio-format wav --cookies-from-browser firefox ..." />
        </UiField>
      </div>
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import TranscriptionConfigList from "./transcription/TranscriptionConfigList.vue";
import WhisperApiForm from "./transcription/WhisperApiForm.vue";
import FasterWhisperBinariesCard from "./transcription/FasterWhisperBinariesCard.vue";
import FasterWhisperModelsCard from "./transcription/FasterWhisperModelsCard.vue";
import FasterWhisperRuntimeCard from "./transcription/FasterWhisperRuntimeCard.vue";
import { useTranscriptionConfig } from "./transcription/composables/useTranscriptionConfig";
import { useFasterWhisper } from "./transcription/composables/useFasterWhisper";
import { UiField, UiInput, UiProgress, UiSection, UiSelect, UiTextarea } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const providerOptions = computed(() => [
  { value: "whisper-api", label: t("transcription-provider-whisper") },
  { value: "faster-whisper", label: t("transcription-provider-faster") }
]);

const {
  transcriptionConfigs,
  activeConfigId,
  selectedConfigId,
  selectedConfig,
  updateConfig,
  updateConfigById,
  handleAddConfig,
  handleDeleteConfig,
  provider,
  isWhisperApi,
  isFasterWhisper,
  baseUrl,
  apiKey,
  model,
  languageField,
  prompt,
  ytDlpArgs,
  extraParamsText,
  extraParamsError,
  fasterWhisperBinary,
  fasterWhisperModel,
  fasterWhisperModelDir,
  fasterWhisperDevice,
  fasterWhisperVadFilter,
  fasterWhisperVadThreshold,
  fasterWhisperVadMethod,
  fasterWhisperUseKim2
} = useTranscriptionConfig(t);

const {
  paths,
  selectedModel,
  isBusy,
  downloadMessage,
  downloadError,
  availableModels,
  customModelInput,
  binaryStatus,
  binaryDownloadsSupported,
  binaryDownloadUnsupportedReason,
  downloadProgress,
  selectedDownloadedModel,
  handleDownloadBinary,
  handleDownloadModel,
  openPath
} = useFasterWhisper({
  t,
  activeConfig: selectedConfig,
  isFasterWhisper,
  updateConfig,
  fasterWhisperModel,
  fasterWhisperModelDir
});

function handleProviderInput(value: string) {
  if (value === "whisper-api" || value === "faster-whisper") {
    provider.value = value;
  }
}

function renameConfig(configId: string, name: string) {
  updateConfigById(configId, { name });
}
</script>
