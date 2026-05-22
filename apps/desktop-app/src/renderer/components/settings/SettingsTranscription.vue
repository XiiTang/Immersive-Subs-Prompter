<template>
  <UiSection :title="t('section-transcription', 'Speech Transcription')">
    <div class="settings-split">
      <TranscriptionConfigList
        :transcription-configs="transcriptionConfigs"
        :active-config-id="activeConfigId"
        :t="t"
        @add="handleAddConfig"
        @delete="handleDeleteConfig"
        @select="(id) => (activeConfigId = id)"
      />
      <div class="settings-split__editor" v-if="activeConfig">
        <UiField id="transcription-name" :label="t('transcription-name-label', 'Config Name')">
          <UiInput v-model="configName" />
        </UiField>
        <UiField id="transcription-provider" :label="t('transcription-provider-label', 'Provider')">
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
          <div class="fw-management-section">
            <div v-if="downloadProgress" class="fw-download-banner">
              <div class="fw-download-banner__info">
                <span class="fw-download-banner__status">{{ downloadProgress.status }}</span>
                <span class="fw-download-banner__percent">{{ downloadProgress.percent }}%</span>
              </div>
              <div class="fw-progress-bar">
                <div class="fw-progress-bar__fill" :style="{ width: downloadProgress.percent + '%' }"></div>
              </div>
            </div>

            <div class="fw-grid">
              <FasterWhisperBinariesCard
                :t="t"
                :binary-status="binaryStatus"
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

            <p v-if="downloadMessage" class="fw-message fw-message--info">{{ downloadMessage }}</p>
            <p v-if="downloadError" class="fw-message fw-message--error">{{ downloadError }}</p>
          </div>
        </template>
        <UiField
          v-if="isWhisperApi"
          id="transcription-extra-params"
          :label="t('transcription-extra-params-label', 'Extra Parameters (JSON)')"
          :hint="t('transcription-extra-params-hint', 'Optional Whisper API payload overrides')"
          :error="extraParamsError"
        >
          <UiTextarea v-model="extraParamsText" :rows="4" />
        </UiField>
        <UiField id="transcription-ytdlp" :label="t('transcription-ytdlp-label', 'yt-dlp Audio Args')" :hint="t('transcription-ytdlp-hint', 'Command line options for downloading audio. Leave empty to use defaults.')">
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
import { UiField, UiInput, UiSection, UiSelect, UiTextarea } from "../ui";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);
const providerOptions = computed(() => [
  { value: "whisper-api", label: t("transcription-provider-whisper", "Whisper API (OpenAI-compatible)") },
  { value: "faster-whisper", label: t("transcription-provider-faster", "Faster-Whisper (local CLI)") }
]);

const {
  transcriptionConfigs,
  activeConfigId,
  activeConfig,
  updateConfig,
  handleAddConfig,
  handleDeleteConfig,
  provider,
  isWhisperApi,
  isFasterWhisper,
  configName,
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
  downloadProgress,
  selectedDownloadedModel,
  handleDownloadBinary,
  handleDownloadModel,
  openPath
} = useFasterWhisper({
  t,
  activeConfig,
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
</script>
