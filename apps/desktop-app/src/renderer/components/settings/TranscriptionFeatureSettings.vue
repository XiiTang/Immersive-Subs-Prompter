<template>
  <UiSection :title="t('feature-transcription-title')">
    <div class="settings-split transcription-feature-settings">
    <TranscriptionConfigList
      :transcription-configs="transcriptionConfigs"
      :selected-config-id="selectedConfigId"
      :t="t"
      @add="handleAddConfig"
      @duplicate="handleDuplicateConfig"
      @delete="handleDeleteConfig"
      @rename="renameConfig"
      @select="selectConfig"
      @reorder="reorderConfig"
      @toggle-enabled="toggleConfigEnabled"
    />
    <div v-if="selectedConfig" class="settings-split__editor">
      <UiSettingRow id="feature-transcription-provider" :label="t('feature-transcription-provider')" control-width="field">
        <UiSelect
          :model-value="selectedConfig.provider"
          :options="providerOptions"
          @update:model-value="updateConfig({ provider: $event as 'whisper-api' | 'faster-whisper' })"
        />
      </UiSettingRow>
      <template v-if="selectedConfig.provider === 'whisper-api'">
        <WhisperApiForm
          :t="t"
          :base-url="selectedConfig.baseUrl"
          :api-key="selectedConfig.apiKey"
          :model="selectedConfig.model"
          :language-field="selectedConfig.language"
          :prompt="selectedConfig.prompt"
          :enable-word-timestamps="selectedConfig.enableWordTimestamps"
          @update:base-url="updateConfig({ baseUrl: $event })"
          @update:api-key="updateConfig({ apiKey: $event })"
          @update:model="updateConfig({ model: $event })"
          @update:language-field="updateConfig({ language: $event })"
          @update:prompt="updateConfig({ prompt: $event })"
          @update:enable-word-timestamps="updateConfig({ enableWordTimestamps: $event })"
        />
        <UiSettingRow id="feature-transcription-extra-params" :label="t('feature-transcription-extra-params')" control-width="editor" stacked>
          <UiTextarea :model-value="extraParamsText" :rows="4" @update:model-value="extraParamsText = $event" />
          <UiMessage v-if="extraParamsError" tone="danger" density="compact">{{ extraParamsError }}</UiMessage>
        </UiSettingRow>
      </template>
      <div v-else class="feature-transcription-faster">
        <FasterWhisperBinariesCard
          v-bind="fasterWhisperBinaryBindings"
          @download-binary="handleDownloadBinary"
          @open-binary-folder="openBinaryFolder"
        />
        <FasterWhisperModelsCard
          v-bind="fasterWhisperModelBindings"
          @download-model="handleDownloadModel"
          @open-models-folder="openModelsFolder"
        />
        <FasterWhisperRuntimeCard
          :t="t"
          :active-config="selectedConfig"
          :available-models="availableModels"
          :models-base-dir="modelsBaseDir"
          :selected-downloaded-model="selectedDownloadedModel"
          :custom-model-input="customModelInput"
          @update:selected-downloaded-model="selectedDownloadedModel = $event"
          @update:custom-model-input="customModelInput = $event"
          @update:config="updateConfig($event)"
        />
      </div>
      <UiSettingRow id="feature-transcription-ytdlp" :label="t('feature-transcription-ytdlp-args')" control-width="editor" stacked>
        <UiTextarea
          :model-value="selectedConfig.ytDlpArgs"
          :rows="3"
          @update:model-value="updateConfig({ ytDlpArgs: $event })"
        />
      </UiSettingRow>
    </div>
    <UiEmptyState v-else :message="t('feature-transcription-no-config')" />
    </div>
  </UiSection>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";
import { UiEmptyState, UiMessage, UiSection, UiSelect, UiSettingRow, UiTextarea } from "../ui";
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
const providerOptions = [
  { value: "whisper-api", label: "Whisper API" },
  { value: "faster-whisper", label: "Faster-Whisper" }
];

const {
  transcriptionConfigs,
  selectedConfigId,
  selectedConfig,
  selectConfig,
  updateConfig,
  renameConfig,
  toggleConfigEnabled,
  reorderConfig,
  handleAddConfig,
  handleDuplicateConfig,
  handleDeleteConfig,
  extraParamsText,
  extraParamsError
} = useTranscriptionConfig(t);

const {
  paths,
  binaryStatus,
  availableModels,
  modelsBaseDir,
  selectedDownloadedModel,
  customModelInput,
  isBusy,
  binaryDownloadProgress,
  binaryDownloadMessage,
  binaryDownloadError,
  modelDownloadProgress,
  modelDownloadMessage,
  modelDownloadError,
  handleDownloadBinary,
  handleDownloadModel,
  openBinaryFolder,
  openModelsFolder
} = useFasterWhisper(selectedConfig, updateConfig);

const fasterWhisperBinaryBindings = computed(() => ({
  t,
  paths: paths.value,
  binaryStatus: binaryStatus.value,
  isBusy: isBusy.value,
  downloadProgress: binaryDownloadProgress.value,
  downloadMessage: binaryDownloadMessage.value,
  downloadError: binaryDownloadError.value
}));

const fasterWhisperModelBindings = computed(() => ({
  t,
  paths: paths.value,
  availableModels: availableModels.value,
  modelsBaseDir: modelsBaseDir.value,
  isBusy: isBusy.value,
  downloadProgress: modelDownloadProgress.value,
  downloadMessage: modelDownloadMessage.value,
  downloadError: modelDownloadError.value
}));
</script>

<style scoped>
.feature-transcription-faster {
  display: grid;
  gap: 10px;
}

@media (max-width: 760px) {
  .transcription-feature-settings {
    grid-template-columns: 1fr;
  }
}
</style>
