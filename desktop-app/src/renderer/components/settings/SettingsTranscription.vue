<template>
  <section class="settings-section">
    <h3 class="settings-section__title">
      {{ t("section-transcription", "Speech Transcription (Whisper API)") }}
    </h3>
    <div class="settings-field settings-field--inline settings-field--justify-start">
      <span class="settings-field__label">{{ t("transcription-active-config", "Active Config") }}</span>
      <select v-model="activeConfigId">
        <option v-for="config in transcriptionConfigs" :key="config.id" :value="config.id">
          {{ config.name || config.id }}
        </option>
      </select>
      <div class="settings-inline-buttons">
        <button type="button" class="text-button" @click="handleAddConfig">
          {{ t("button-add", "Add") }}
        </button>
        <button
          type="button"
          class="text-button"
          :disabled="transcriptionConfigs.length <= 1"
          @click="handleDeleteConfig"
        >
          {{ t("button-delete", "Delete") }}
        </button>
      </div>
    </div>
    <template v-if="activeConfig">
      <label class="settings-field">
        <span class="settings-field__label">{{ t("transcription-name-label", "Config Name") }}</span>
        <input type="text" v-model="configName" />
      </label>
      <label class="settings-field">
        <span class="settings-field__label">{{ t("transcription-base-url-label", "API Base URL") }}</span>
        <input type="text" v-model="baseUrl" placeholder="https://api.openai.com/v1" />
      </label>
      <label class="settings-field">
        <span class="settings-field__label">{{ t("transcription-api-key-label", "API Key") }}</span>
        <input type="text" v-model="apiKey" placeholder="sk-..." />
      </label>
      <div class="settings-field settings-field--inline">
        <div class="settings-field__inline">
          <span class="settings-field__label">{{ t("transcription-model-label", "Model") }}</span>
          <input type="text" v-model="model" placeholder="whisper-1" />
        </div>
        <div class="settings-field__inline">
          <span class="settings-field__label">{{ t("transcription-language-label", "Language") }}</span>
          <input type="text" v-model="languageField" placeholder="auto" />
        </div>
      </div>
      <label class="settings-field">
        <span class="settings-field__label">{{ t("transcription-prompt-label", "Prompt") }}</span>
        <input type="text" v-model="prompt" />
      </label>
      <div class="settings-field settings-field--inline">
        <span class="settings-field__label">{{ t("transcription-word-timestamps", "Word timestamps") }}</span>
        <label class="toggle">
          <input type="checkbox" v-model="enableWordTimestamps" />
          <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
        </label>
      </div>
      <label class="settings-field">
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
        <input type="text" v-model="ytDlpArgs" placeholder="--extract-audio --audio-format mp3 ..." />
      </label>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const transcriptionConfigs = computed(() => store.settings?.transcription.configs ?? []);
const activeConfigId = computed({
  get: () =>
    store.settings?.transcription.activeConfigId ?? transcriptionConfigs.value[0]?.id ?? "",
  set: (value: string) => store.setActiveTranscriptionConfig(value)
});

const activeConfig = computed(() =>
  transcriptionConfigs.value.find((config) => config.id === activeConfigId.value) ?? null
);

const extraParamsError = ref<string | null>(null);
const extraParamsText = computed({
  get: () => JSON.stringify(activeConfig.value?.extraParams ?? {}, null, 2),
  set: (value: string) => {
    if (!activeConfig.value) {
      return;
    }
    const trimmed = value.trim();
    if (!trimmed.length) {
      store.updateTranscriptionConfig(activeConfig.value.id, { extraParams: {} });
      extraParamsError.value = null;
      return;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        store.updateTranscriptionConfig(activeConfig.value.id, { extraParams: parsed as Record<string, string> });
        extraParamsError.value = null;
      } else {
        extraParamsError.value = t("transcription-extra-params-invalid", "Please enter a valid JSON object.");
      }
    } catch (error) {
      extraParamsError.value =
        error instanceof Error ? error.message : t("transcription-extra-params-invalid", "Please enter a valid JSON object.");
    }
  }
});

watch(activeConfig, () => {
  extraParamsError.value = null;
});

function updateConfig(patch: Record<string, unknown>) {
  if (!activeConfig.value) {
    return;
  }
  store.updateTranscriptionConfig(activeConfig.value.id, patch);
}

function handleAddConfig() {
  const id = store.addTranscriptionConfig();
  if (id) {
    store.setActiveTranscriptionConfig(id);
  }
}

function handleDeleteConfig() {
  if (!activeConfig.value) {
    return;
  }
  store.deleteTranscriptionConfig(activeConfig.value.id);
}

const configName = computed({
  get: () => activeConfig.value?.name ?? "",
  set: (value: string) => updateConfig({ name: value })
});

const baseUrl = computed({
  get: () => activeConfig.value?.baseUrl ?? "",
  set: (value: string) => updateConfig({ baseUrl: value })
});

const apiKey = computed({
  get: () => activeConfig.value?.apiKey ?? "",
  set: (value: string) => updateConfig({ apiKey: value })
});

const model = computed({
  get: () => activeConfig.value?.model ?? "",
  set: (value: string) => updateConfig({ model: value })
});

const languageField = computed({
  get: () => activeConfig.value?.language ?? "",
  set: (value: string) => updateConfig({ language: value })
});

const prompt = computed({
  get: () => activeConfig.value?.prompt ?? "",
  set: (value: string) => updateConfig({ prompt: value })
});

const enableWordTimestamps = computed({
  get: () => activeConfig.value?.enableWordTimestamps ?? false,
  set: (value: boolean) => updateConfig({ enableWordTimestamps: value })
});

const ytDlpArgs = computed({
  get: () => activeConfig.value?.ytDlpArgs ?? "",
  set: (value: string) => updateConfig({ ytDlpArgs: value })
});
</script>
