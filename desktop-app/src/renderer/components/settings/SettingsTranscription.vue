<template>
  <section class="settings-section">
    <header class="settings-section__intro settings-section__intro--with-toggle">
      <div>
        <h3 class="settings-section__title">{{ t("section-transcription", "Speech Transcription") }}</h3>
      </div>
      <label class="toggle toggle--sm settings-section__toggle">
        <input type="checkbox" v-model="transcriptionEnabled" />
        <span class="toggle__text">{{ t("transcription-enable-label", "Enable Transcription") }}</span>
      </label>
    </header>
    <div class="transcription-settings settings-surface settings-surface--split" v-if="transcriptionEnabled">
      <div class="transcription-settings__sidebar">
        <div class="transcription-settings__actions">
          <span class="settings-field__label">{{ t("transcription-active-config", "Active Config") }}</span>
          <div class="transcription-settings__buttons">
            <button
              type="button"
              class="icon-button"
              :title="t('button-add', 'Add')"
              :aria-label="t('button-add', 'Add')"
              @click="handleAddConfig"
            >
              <IconAdd size="md" />
            </button>
            <button
              type="button"
              class="icon-button"
              :disabled="transcriptionConfigs.length <= 1"
              :title="t('button-delete', 'Delete')"
              :aria-label="t('button-delete', 'Delete')"
              @click="handleDeleteConfig"
            >
              <IconDelete size="md" />
            </button>
          </div>
        </div>
        <div class="transcription-config-list">
          <template v-if="transcriptionConfigs.length">
            <button
              v-for="config in transcriptionConfigs"
              :key="config.id"
              type="button"
              class="transcription-config-list__item"
              :class="{ 'is-selected': config.id === activeConfigId }"
              @click="activeConfigId = config.id"
            >
              <div class="transcription-config-list__name">
                <span class="transcription-config-list__label">{{ config.name || config.id }}</span>
                <span v-if="config.id === activeConfigId" class="transcription-config-list__badge">
                  {{ t("transcription-config-active-badge", "Active") }}
                </span>
              </div>
              <div class="transcription-config-list__meta">
                <span class="transcription-config-list__pill">
                  {{ getProviderLabel(config.provider) }}
                </span>
                <span class="transcription-config-list__muted">
                  {{ getModelLabel(config) }}
                </span>
              </div>
            </button>
          </template>
          <div v-else class="transcription-config-list__empty">
            {{ t("transcription-config-empty", "No transcription configs yet") }}
          </div>
        </div>
      </div>
      <div class="transcription-settings__editor" v-if="activeConfig">
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
        </div>
        <div class="settings-field settings-field--inline">
          <div class="settings-field__inline">
            <span class="settings-field__label">{{ t("transcription-language-label", "Language") }}</span>
            <input type="text" v-model="languageField" placeholder="auto" />
          </div>
        </div>
        <label class="settings-field">
          <span class="settings-field__label">{{ t("transcription-prompt-label", "Prompt") }}</span>
          <input type="text" v-model="prompt" />
        </label>
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
            <!-- Card 1: System Binaries -->
            <div class="fw-card">
              <div class="fw-card__header">
                <div class="fw-card__title">{{ t("transcription-faster-binary-status", "System Integration") }}</div>
              </div>

              <div class="fw-card__content">
                <div class="fw-row two-col">
                  <div class="fw-status-row">
                    <div class="fw-status-item">
                      <span class="label">{{ t("transcription-faster-cpu-support", "CPU") }}</span>
                      <span class="fw-badge" :class="binaryStatus.cpu ? 'fw-badge--success' : 'fw-badge--error'">
                        {{
                          binaryStatus.cpu
                            ? t("transcription-faster-binary-present", "Ready")
                            : t("transcription-faster-binary-missing", "Missing")
                        }}
                      </span>
                    </div>
                    <button
                      type="button"
                      class="btn-secondary"
                      @click="handleDownloadBinary('cpu')"
                      :disabled="isBusy"
                    >
                      {{ binaryStatus.cpu ? t("button-redownload", "Redownload") : t("button-download", "Download") }}
                    </button>
                  </div>

                  <div class="fw-status-row">
                    <div class="fw-status-item">
                      <span class="label">{{ t("transcription-faster-gpu-cuda", "GPU") }}</span>
                      <span class="fw-badge" :class="binaryStatus.gpu ? 'fw-badge--success' : 'fw-badge--error'">
                        {{
                          binaryStatus.gpu
                            ? t("transcription-faster-binary-present", "Ready")
                            : t("transcription-faster-binary-missing", "Missing")
                        }}
                      </span>
                    </div>
                    <button
                      type="button"
                      class="btn-secondary"
                      @click="handleDownloadBinary('gpu')"
                      :disabled="isBusy"
                    >
                      {{ binaryStatus.gpu ? t("button-redownload", "Redownload") : t("button-download", "Download") }}
                    </button>
                  </div>
                </div>

                <div class="fw-folder-input">
                  <div class="fw-field-header">
                    <span class="label">{{ t("transcription-faster-binary", "Binary Path") }}</span>
                    <button
                      type="button"
                      class="icon-text-button"
                      @click="openPath(paths?.binaryDir)"
                      :title="t('transcription-faster-open-bin', 'Open folder')"
                    >
                      <span class="icon">📂</span>
                    </button>
                  </div>
                  <input type="text" v-model="fasterWhisperBinary" placeholder="faster-whisper" class="fw-input-sm" />
                </div>
              </div>
            </div>

            <!-- Card 2: AI Models -->
            <div class="fw-card">
              <div class="fw-card__header">
                <div class="fw-card__title">{{ t("transcription-faster-models-available", "AI Models") }}</div>
              </div>

              <div class="fw-card__content">
                <div class="fw-model-row">
                  <template v-if="availableModels.length">
                    <span v-for="model in availableModels" :key="model.path" class="fw-model-chip">
                      {{ model.name }}
                    </span>
                  </template>
                  <span v-else class="fw-model-empty-hint">
                    {{ t("transcription-faster-model-missing", "No downloaded models detected") }}
                  </span>
                  <div class="fw-model-download">
                    <select v-model="selectedModel" class="fw-select">
                      <option v-for="model in fasterWhisperModels" :key="model.value" :value="model.value">
                        {{ model.label }}
                      </option>
                    </select>
                    <button type="button" class="btn-primary" @click="handleDownloadModel" :disabled="isBusy">
                      {{ t("transcription-faster-download-model", "Download") }}
                    </button>
                  </div>
                </div>
                
                <div class="fw-folder-input">
                   <div class="fw-field-header">
                      <span class="label">{{ t("transcription-faster-model-dir", "Model Path (Optional)") }}</span>
                      <button
                        type="button"
                        class="icon-text-button"
                        @click="openPath(paths?.modelsDir)"
                        :title="t('transcription-faster-open-models', 'Open folder')"
                      >
                        <span class="icon">📂</span>
                      </button>
                   </div>
                   <input type="text" v-model="fasterWhisperModelDir" placeholder="~/models/faster-whisper" class="fw-input-sm" />
                </div>
              </div>
            </div>
          </div>

          <!-- Card 3: Runtime Configuration -->
          <div class="fw-card">
            <div class="fw-card__header">
              <div class="fw-card__title">{{ t("transcription-runtime-config", "Runtime Configuration") }}</div>
            </div>

            <div class="fw-card__content">
              <!-- Active Model & Device Row -->
              <div class="fw-row two-col">
                <div class="fw-field">
                  <span class="label">{{ t("transcription-faster-model", "Active Model") }}</span>
                  <div class="fw-select-group">
                    <select class="fw-select" v-model="selectedDownloadedModel">
                       <option v-if="!availableModels.length" value="custom">
                          {{ t("transcription-faster-model-missing", "No downloaded models detected") }}
                        </option>
                        <option v-for="model in availableModels" :key="model.path" :value="model.name">
                          {{ model.name }}
                        </option>
                        <option value="custom">{{ t("transcription-faster-model-custom", "Custom value") }}</option>
                    </select>
                    <input
                      v-if="selectedDownloadedModel === 'custom'"
                      type="text"
                      v-model="customModelInput"
                      placeholder="medium"
                      class="fw-input-sm"
                    />
                  </div>
                </div>

                <div class="fw-field">
                  <span class="label">{{ t("transcription-faster-device", "Device") }}</span>
                  <select v-model="fasterWhisperDevice" class="fw-select">
                    <option value="cpu">CPU</option>
                    <option value="cuda">CUDA (GPU)</option>
                  </select>
                </div>
              </div>

              <!-- VAD Settings Row -->
              <div class="fw-row three-col">
                 <div class="fw-field">
                   <div class="fw-field-header">
                      <span class="label">{{ t("transcription-faster-vad-filter", "VAD Filter") }}</span>
                       <label class="toggle toggle--sm">
                          <input type="checkbox" v-model="fasterWhisperVadFilter" />
                          <span class="toggle__text"></span>
                        </label>
                   </div>
                 </div>
                 
                  <div class="fw-field">
                    <span class="label">{{ t("transcription-faster-vad-threshold", "Threshold") }}</span>
                    <input type="number" min="0" max="1" step="0.05" v-model.number="fasterWhisperVadThreshold" class="fw-input-sm" />
                  </div>

                  <div class="fw-field">
                     <span class="label">{{ t("transcription-faster-vad-method", "VAD Method") }}</span>
                     <input type="text" v-model="fasterWhisperVadMethod" placeholder="silero" class="fw-input-sm" />
                  </div>
              </div>

              <!-- Extra Options Row -->
              <div class="fw-row two-col">
                 <div class="fw-field">
                   <span class="label">{{ t("transcription-language-label", "Language") }}</span>
                   <input type="text" v-model="languageField" placeholder="auto" class="fw-input-sm" />
                 </div>
                 
                 <div class="fw-field">
                   <span class="label">{{ t("transcription-prompt-label", "Prompt") }}</span>
                   <input type="text" v-model="prompt" class="fw-input-sm" />
                 </div>
              </div>

              <div class="fw-row">
                 <div class="fw-field fw-field--inline">
                   <span class="label">{{ t("transcription-faster-kim2", "Voice Separation (Kim2)") }}</span>
                    <label class="toggle toggle--sm">
                      <input type="checkbox" v-model="fasterWhisperUseKim2" />
                       <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
                    </label>
                 </div>
              </div>

            </div>
          </div>  

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
import { computed, onWatcherCleanup, ref, watch } from "vue";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import type { TranscriptionConfig } from "../../../main/types";
import { useDesktopStore } from "../../stores/desktop";
import { IconAdd, IconDelete } from "../icons";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

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

const transcriptionEnabled = computed({
  get: () => store.settings?.transcription.enabled ?? true,
  set: (value: boolean) => store.setTranscriptionEnabled(value)
});

const transcriptionConfigs = computed(() => store.settings?.transcription.configs ?? []);
const activeConfigId = computed({
  get: () =>
    store.settings?.transcription.activeConfigId ?? transcriptionConfigs.value[0]?.id ?? "",
  set: (value: string) => store.setActiveTranscriptionConfig(value)
});

const activeConfig = computed(() =>
  transcriptionConfigs.value.find((config) => config.id === activeConfigId.value) ?? null
);

const paths = ref<{
  binaryDir: string;
  modelsDir: string;
  cpuBinaryPath: string;
  gpuBinaryPath: string;
} | null>(null);
const selectedModel = ref("tiny");
const isBusy = ref(false);
const downloadMessage = ref("");
const downloadError = ref("");
const availableModels = ref<Array<{ name: string; path: string; folder: string }>>([]);
const modelsBaseDir = ref("");
const customModelInput = ref("");
const binaryStatus = ref({ cpu: false, gpu: false });
const downloadProgress = ref<{
  id: string;
  type: "binary" | "model";
  variant?: "cpu" | "gpu";
  model?: string;
  percent: number;
  status: string;
} | null>(null);
const activeJobId = ref<string | null>(null);
let unsubscribeDownloadProgress: (() => void) | null = null;

const provider = computed({
  get: () => activeConfig.value?.provider ?? "whisper-api",
  set: (value: string) => updateConfig({ provider: value })
});

const isWhisperApi = computed(() => provider.value === "whisper-api");
const isFasterWhisper = computed(() => provider.value === "faster-whisper");

function getProviderLabel(provider: TranscriptionConfig["provider"] | undefined) {
  if (provider === "faster-whisper") {
    return t("transcription-provider-faster-short", "Faster-Whisper");
  }
  return t("transcription-provider-whisper-short", "Whisper API");
}

function getModelLabel(config: TranscriptionConfig) {
  const languageLabel = (config.language || "auto").trim() || "auto";
  if (config.provider === "faster-whisper") {
    const modelName = (config.fasterWhisperModel || t("transcription-faster-model", "Model")).trim();
    return `${modelName} · ${languageLabel}`;
  }
  const modelName = (config.model || t("transcription-model-label", "Model")).trim();
  return `${modelName} · ${languageLabel}`;
}

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

function shouldUseFasterWhisper() {
  return transcriptionEnabled.value && isFasterWhisper.value && !!activeConfig.value;
}

function ensureDownloadSubscription() {
  if (!unsubscribeDownloadProgress) {
    unsubscribeDownloadProgress = window.usp.onFasterWhisperDownloadProgress(handleDownloadProgress);
  }
}

function teardownDownloadSubscription() {
  if (unsubscribeDownloadProgress) {
    unsubscribeDownloadProgress();
    unsubscribeDownloadProgress = null;
  }
}

async function initializeFasterWhisper() {
  if (!shouldUseFasterWhisper()) {
    return;
  }
  try {
    paths.value = await window.usp.getFasterWhisperPaths();
    if (!activeConfig.value?.fasterWhisperModelDir && paths.value?.modelsDir) {
      updateConfig({ fasterWhisperModelDir: paths.value.modelsDir });
    }
    modelsBaseDir.value = paths.value?.modelsDir ?? modelsBaseDir.value;
  } catch (error) {
    console.error("Failed to load Faster-Whisper paths", error);
  }
  await refreshStatus();
}

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

const fasterWhisperBinary = computed({
  get: () => activeConfig.value?.fasterWhisperBinary ?? "",
  set: (value: string) => updateConfig({ fasterWhisperBinary: value })
});

const fasterWhisperModel = computed({
  get: () => activeConfig.value?.fasterWhisperModel ?? "",
  set: (value: string) => updateConfig({ fasterWhisperModel: value })
});

const fasterWhisperModelDir = computed({
  get: () => activeConfig.value?.fasterWhisperModelDir ?? "",
  set: (value: string) => updateConfig({ fasterWhisperModelDir: value })
});

const selectedDownloadedModel = computed({
  get: () => {
    const current = fasterWhisperModel.value;
    if (!current) {
      return availableModels.value.length ? availableModels.value[0].name : "custom";
    }
    const normalized = normalizeModelName(current);
    const match = availableModels.value.find(
      (model) => model.name === normalized || model.folder === current || model.path === current
    );
    return match ? match.name : "custom";
  },
  set: (value: string) => {
    if (value === "custom") {
      updateConfig({ fasterWhisperModel: customModelInput.value });
      return;
    }
    customModelInput.value = value;
    updateConfig({
      fasterWhisperModel: value,
      fasterWhisperModelDir:
        activeConfig.value?.fasterWhisperModelDir || paths.value?.modelsDir || modelsBaseDir.value || ""
    });
  }
});

watch(customModelInput, (value) => {
  if (selectedDownloadedModel.value === "custom") {
    updateConfig({ fasterWhisperModel: value });
  }
});

watch(
  [transcriptionEnabled, isFasterWhisper, activeConfig],
  () => {
    if (!shouldUseFasterWhisper()) {
      teardownDownloadSubscription();
      downloadProgress.value = null;
      return;
    }

    ensureDownloadSubscription();
    onWatcherCleanup(() => {
      teardownDownloadSubscription();
      downloadProgress.value = null;
    });
    void initializeFasterWhisper();
  },
  { immediate: true }
);

watch(activeConfig, () => {
  extraParamsError.value = null;
  if (activeConfig.value?.fasterWhisperModel) {
    selectedModel.value = activeConfig.value.fasterWhisperModel;
  }
  customModelInput.value = activeConfig.value?.fasterWhisperModel ?? "";
  if (!activeConfig.value?.fasterWhisperModelDir && paths.value?.modelsDir) {
    updateConfig({ fasterWhisperModelDir: paths.value.modelsDir });
  }
});

watch(
  () => fasterWhisperModelDir.value,
  () => {
    if (shouldUseFasterWhisper()) {
      void refreshStatus();
    }
  }
);

watch(downloadProgress, (progress) => {
  if (!progress || progress.percent < 100) {
    return;
  }

  const clearProgressTimer = window.setTimeout(() => {
    if (downloadProgress.value?.id === progress.id) {
      downloadProgress.value = null;
    }
  }, 800);

  onWatcherCleanup(() => {
    window.clearTimeout(clearProgressTimer);
  });
});

const fasterWhisperDevice = computed({
  get: () => activeConfig.value?.fasterWhisperDevice ?? "cpu",
  set: (value: "cpu" | "cuda") => updateConfig({ fasterWhisperDevice: value })
});

const fasterWhisperVadFilter = computed({
  get: () => activeConfig.value?.fasterWhisperVadFilter ?? true,
  set: (value: boolean) => updateConfig({ fasterWhisperVadFilter: value })
});

const fasterWhisperVadThreshold = computed({
  get: () => activeConfig.value?.fasterWhisperVadThreshold ?? 0.5,
  set: (value: number) => {
    const current = activeConfig.value?.fasterWhisperVadThreshold ?? 0.5;
    const normalized = Number.isFinite(value) ? value : current;
    updateConfig({ fasterWhisperVadThreshold: normalized });
  }
});

const fasterWhisperVadMethod = computed({
  get: () => activeConfig.value?.fasterWhisperVadMethod ?? "",
  set: (value: string) => updateConfig({ fasterWhisperVadMethod: value })
});

const fasterWhisperUseKim2 = computed({
  get: () => activeConfig.value?.fasterWhisperUseKim2 ?? false,
  set: (value: boolean) => updateConfig({ fasterWhisperUseKim2: value })
});

const languageField = computed({
  get: () => activeConfig.value?.language ?? "",
  set: (value: string) => updateConfig({ language: value })
});

const prompt = computed({
  get: () => activeConfig.value?.prompt ?? "",
  set: (value: string) => updateConfig({ prompt: value })
});



const ytDlpArgs = computed({
  get: () => activeConfig.value?.ytDlpArgs ?? "",
  set: (value: string) => updateConfig({ ytDlpArgs: value })
});

function normalizeModelName(name: string) {
  const trimmed = (name || "").trim();
  return trimmed.startsWith("faster-whisper-") ? trimmed.replace(/^faster-whisper-/, "") : trimmed;
}

function createJobId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${(crypto as Crypto).randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function handleDownloadProgress(payload: {
  id: string;
  type: "binary" | "model";
  variant?: "cpu" | "gpu";
  model?: string;
  percent: number;
  status: string;
}) {
  if (activeJobId.value && payload.id !== activeJobId.value) {
    return;
  }
  downloadProgress.value = payload;
  if (payload.percent >= 100 && payload.id === activeJobId.value) {
    activeJobId.value = null;
    if (payload.type === "model" || payload.type === "binary") {
      void refreshStatus();
    }
  }
}

async function handleDownloadBinary(variant: "cpu" | "gpu") {
  if (isBusy.value) return;
  downloadMessage.value = "";
  downloadError.value = "";
  const jobId = createJobId(`fw-${variant}`);
  activeJobId.value = jobId;
  downloadProgress.value = {
    id: jobId,
    type: "binary",
    variant,
    percent: 0,
    status: t("transcription-faster-download-start", "Preparing download...")
  };
  isBusy.value = true;
  try {
    const result = await window.usp.downloadFasterWhisperBinary({ variant, jobId });
    if (!result?.ok || !result.path) {
      throw new Error(result?.error || "Download failed");
    }
    downloadMessage.value = t("transcription-faster-download-success", "Download completed: ") + result.path;
    updateConfig({ fasterWhisperBinary: result.path });
    paths.value = await window.usp.getFasterWhisperPaths();
    await refreshStatus();
  } catch (error) {
    activeJobId.value = null;
    downloadProgress.value = null;
    downloadError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isBusy.value = false;
  }
}

async function handleDownloadModel() {
  if (isBusy.value) return;
  downloadMessage.value = "";
  downloadError.value = "";
  const model = selectedModel.value;
  const jobId = createJobId(`fw-${model}`);
  activeJobId.value = jobId;
  downloadProgress.value = {
    id: jobId,
    type: "model",
    model,
    percent: 0,
    status: t("transcription-faster-model-start", "Preparing model download...")
  };
  isBusy.value = true;
  try {
    const result = await window.usp.downloadFasterWhisperModel({ model, jobId });
    if (!result?.ok || !result.path) {
      throw new Error(result?.error || "Download failed");
    }
    downloadMessage.value =
      t("transcription-faster-model-success", "Model downloaded to: ") + result.path;
    updateConfig({
      fasterWhisperModel: model,
      fasterWhisperModelDir: paths.value?.modelsDir || modelsBaseDir.value || "",
      provider: "faster-whisper"
    });
    paths.value = await window.usp.getFasterWhisperPaths();
    await refreshStatus();
  } catch (error) {
    activeJobId.value = null;
    downloadProgress.value = null;
    downloadError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isBusy.value = false;
  }
}

async function openPath(target?: string | null) {
  if (!target) return;
  try {
    await window.usp.openPath(target);
  } catch (error) {
    downloadError.value = error instanceof Error ? error.message : String(error);
  }
}

async function refreshStatus() {
  if (!shouldUseFasterWhisper()) {
    return;
  }
  const targetDir =
    (activeConfig.value?.fasterWhisperModelDir || "").trim() ||
    paths.value?.modelsDir ||
    modelsBaseDir.value;
  try {
    const status = await window.usp.getFasterWhisperStatus(targetDir);
    if (!status?.ok) return;
    if (status.paths) {
      paths.value = status.paths;
    }
    binaryStatus.value = {
      cpu: !!status.binaries?.cpu?.exists,
      gpu: !!status.binaries?.gpu?.exists
    };
    if (status.models) {
      availableModels.value = status.models;
    }
    modelsBaseDir.value = status.modelsBaseDir || status.paths?.modelsDir || targetDir || modelsBaseDir.value;
  } catch (error) {
    console.error("Failed to refresh Faster-Whisper status", error);
  }
}
</script>
