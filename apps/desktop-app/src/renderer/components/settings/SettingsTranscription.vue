<template>
  <section class="settings-section">
    <header class="settings-section__intro">
      <div>
        <h3 class="settings-section__title">{{ t("section-transcription", "Speech Transcription") }}</h3>
      </div>
    </header>
    <div class="settings-split settings-surface settings-surface--split">
      <TranscriptionConfigList
        :transcription-configs="transcriptionConfigs"
        :active-config-id="activeConfigId"
        :t="t"
        @add="handleAddConfig"
        @delete="handleDeleteConfig"
        @select="(id) => (activeConfigId = id)"
      />
      <div class="settings-split__editor" v-if="activeConfig">
        <label class="settings-field">
          <span class="settings-field__label">{{ t("transcription-name-label", "Config Name") }}</span>
          <input type="text" v-model="configName" />
        </label>
        <div class="settings-field settings-field--inline settings-field--justify-start">
          <span class="settings-field__label">{{ t("transcription-provider-label", "Provider") }}</span>
          <select v-model="provider">
            <option value="whisper-api">
              {{ t("transcription-provider-whisper", "Whisper API (OpenAI-compatible)") }}
            </option>
            <option value="faster-whisper">
              {{ t("transcription-provider-faster", "Faster-Whisper (local CLI)") }}
            </option>
          </select>
        </div>
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
        <label v-if="isWhisperApi" class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">
              {{ t("transcription-extra-params-label", "Extra Parameters (JSON)") }}
            </span>
            <small class="settings-field__hint">
              {{ t("transcription-extra-params-hint", "Optional Whisper API payload overrides") }}
            </small>
          </div>
          <textarea rows="4" v-model="extraParamsText"></textarea>
          <small v-if="extraParamsError" class="settings-field__error">{{ extraParamsError }}</small>
        </label>
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">{{ t("transcription-ytdlp-label", "yt-dlp Audio Args") }}</span>
            <small class="settings-field__hint">
              {{
                t(
                  "transcription-ytdlp-hint",
                  "Command line options for downloading audio. Leave empty to use defaults."
                )
              }}
            </small>
          </div>
          <input type="text" v-model="ytDlpArgs" placeholder="--extract-audio --audio-format wav --cookies-from-browser firefox ..." />
        </label>
      </div>
    </div>
  </section>
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

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

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
</script>
