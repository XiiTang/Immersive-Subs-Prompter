<template>
  <section class="settings-section">
    <h3 class="settings-section__title">
      {{ t("section-transcription", "Speech Transcription") }}
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
      </template>
      <template v-else-if="isFasterWhisper">
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">{{ t("transcription-faster-binary", "Faster-Whisper Binary") }}</span>
            <small class="settings-field__hint">
              {{ t("transcription-faster-binary-hint", "Path to faster-whisper / faster-whisper-xxl executable") }}
            </small>
          </div>
          <input type="text" v-model="fasterWhisperBinary" placeholder="faster-whisper" />
        </label>
        <label class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">{{ t("transcription-faster-model", "Model") }}</span>
            <small class="settings-field__hint">
              {{
                t(
                  "transcription-faster-model-hint",
                  "Choose a downloaded model (use the download menu to add more)"
                )
              }}
            </small>
          </div>
          <div class="settings-select-row">
            <select class="settings-field__select" v-model="selectedDownloadedModel">
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
            />
          </div>
          <small v-if="modelsBaseDir" class="settings-field__hint">
            {{ t("transcription-faster-model-dir-hint-short", "Scanning: ") + modelsBaseDir }}
          </small>
        </label>
        <div class="settings-field settings-field--inline">
          <div class="settings-field__inline">
            <span class="settings-field__label">{{ t("transcription-faster-device", "Device") }}</span>
            <select v-model="fasterWhisperDevice">
              <option value="cpu">CPU</option>
              <option value="cuda">CUDA</option>
            </select>
          </div>
          <div class="settings-field__inline">
            <span class="settings-field__label">{{ t("transcription-faster-vad-filter", "VAD filter") }}</span>
            <label class="toggle">
              <input type="checkbox" v-model="fasterWhisperVadFilter" />
              <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
            </label>
          </div>
        </div>
        <div class="settings-field settings-field--inline">
          <div class="settings-field__inline">
            <span class="settings-field__label">{{ t("transcription-faster-vad-threshold", "VAD threshold") }}</span>
            <input type="number" min="0" max="1" step="0.05" v-model.number="fasterWhisperVadThreshold" />
          </div>
          <div class="settings-field__inline">
            <span class="settings-field__label">{{ t("transcription-faster-vad-method", "VAD method") }}</span>
            <input type="text" v-model="fasterWhisperVadMethod" placeholder="silero-v3 / silero-v4 ..." />
          </div>
        </div>
        <div class="settings-field settings-field--inline">
          <span class="settings-field__label">{{ t("transcription-faster-kim2", "Voice separation (ff_mdx_kim2)") }}</span>
          <label class="toggle">
            <input type="checkbox" v-model="fasterWhisperUseKim2" />
            <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
          </label>
        </div>
        <div class="settings-field">
          <div class="settings-field__label-row">
            <span class="settings-field__label">{{ t("transcription-faster-model-dir", "Model directory (optional)") }}</span>
            <small class="settings-field__hint">
              {{ t("transcription-faster-model-dir-hint", "Used for cached models, leave blank to use default") }}
            </small>
          </div>
          <input type="text" v-model="fasterWhisperModelDir" placeholder="~/models/faster-whisper" />
        </div>
        <div class="settings-subsection">
          <button
            type="button"
            class="settings-subsection__toggle"
            :aria-expanded="showDownloadPanel"
            @click="toggleDownloadPanel"
          >
            <span>{{ t("transcription-faster-downloads", "Downloads & management") }}</span>
            <span class="settings-subsection__chevron" :class="{ 'is-open': showDownloadPanel }">›</span>
          </button>
          <div v-if="showDownloadPanel" class="settings-subsection__content">
            <div class="settings-field settings-field--inline settings-field--justify-start fast-fw-actions">
              <div class="settings-field__inline">
                <span class="settings-field__label">{{ t("transcription-faster-binary", "Faster-Whisper Binary") }}</span>
                <div class="settings-inline-buttons">
                  <button type="button" class="text-button" @click="handleDownloadBinary('cpu')" :disabled="isBusy">
                    {{ t("transcription-faster-download-cpu", "Download CPU binary") }}
                  </button>
                  <button type="button" class="text-button" @click="handleDownloadBinary('gpu')" :disabled="isBusy">
                    {{ t("transcription-faster-download-gpu", "Download GPU binary") }}
                  </button>
                  <button type="button" class="text-button" @click="openPath(paths?.binaryDir)" :disabled="isBusy">
                    {{ t("transcription-faster-open-bin", "Open binary folder") }}
                  </button>
                </div>
              </div>
            </div>
            <div class="settings-field settings-field--inline settings-field--justify-start">
              <div class="settings-field__inline">
                <span class="settings-field__label">{{ t("transcription-faster-model-preset", "Model preset") }}</span>
                <select v-model="selectedModel">
                  <option v-for="model in fasterWhisperModels" :key="model.value" :value="model.value">
                    {{ model.label }}
                  </option>
                </select>
              </div>
              <div class="settings-field__inline">
                <div class="settings-inline-buttons">
                  <button type="button" class="text-button" @click="handleDownloadModel" :disabled="isBusy">
                    {{ t("transcription-faster-download-model", "Download model") }}
                  </button>
                  <button type="button" class="text-button" @click="openPath(paths?.modelsDir)" :disabled="isBusy">
                    {{ t("transcription-faster-open-models", "Open models folder") }}
                  </button>
                </div>
              </div>
            </div>
            <div v-if="downloadProgress" class="download-progress">
              <div class="download-progress__labels">
                <span>{{ downloadProgress.status }}</span>
                <span>{{ downloadProgress.percent }}%</span>
              </div>
              <div class="download-progress__bar">
                <div class="download-progress__bar-fill" :style="{ width: downloadProgress.percent + '%' }"></div>
              </div>
            </div>
            <p v-if="downloadMessage" class="settings-field__hint">{{ downloadMessage }}</p>
            <p v-if="downloadError" class="settings-field__error">{{ downloadError }}</p>
          </div>
        </div>
      </template>
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
      <div class="settings-field settings-field--inline">
        <span class="settings-field__label">{{ t("transcription-word-timestamps", "Word timestamps") }}</span>
        <label class="toggle">
          <input type="checkbox" v-model="enableWordTimestamps" />
          <span class="toggle__text">{{ t("toggle-enable", "Enable") }}</span>
        </label>
      </div>
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
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n";
import { useDesktopStore } from "../../stores/desktop";

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
const showDownloadPanel = ref(false);
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

onMounted(async () => {
  try {
    paths.value = await window.usp.getFasterWhisperPaths();
    if (!activeConfig.value?.fasterWhisperModelDir && paths.value?.modelsDir) {
      updateConfig({ fasterWhisperModelDir: paths.value.modelsDir });
    }
    modelsBaseDir.value = paths.value?.modelsDir ?? modelsBaseDir.value;
    await refreshAvailableModels();
  } catch (error) {
    console.error("Failed to load Faster-Whisper paths", error);
  }
  unsubscribeDownloadProgress = window.usp.onFasterWhisperDownloadProgress(handleDownloadProgress);
});

onBeforeUnmount(() => {
  if (unsubscribeDownloadProgress) {
    unsubscribeDownloadProgress();
    unsubscribeDownloadProgress = null;
  }
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

watch(activeConfig, () => {
  extraParamsError.value = null;
  if (activeConfig.value?.fasterWhisperModel) {
    selectedModel.value = activeConfig.value.fasterWhisperModel;
  }
  customModelInput.value = activeConfig.value?.fasterWhisperModel ?? "";
  if (!activeConfig.value?.fasterWhisperModelDir && paths.value?.modelsDir) {
    updateConfig({ fasterWhisperModelDir: paths.value.modelsDir });
  }
  refreshAvailableModels();
});

watch(availableModels, (list) => {
  if (!list.length) {
    showDownloadPanel.value = true;
  }
});

watch(
  () => fasterWhisperModelDir.value,
  () => {
    refreshAvailableModels();
  }
);

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

const enableWordTimestamps = computed({
  get: () => activeConfig.value?.enableWordTimestamps ?? false,
  set: (value: boolean) => updateConfig({ enableWordTimestamps: value })
});

const ytDlpArgs = computed({
  get: () => activeConfig.value?.ytDlpArgs ?? "",
  set: (value: string) => updateConfig({ ytDlpArgs: value })
});

function toggleDownloadPanel() {
  showDownloadPanel.value = !showDownloadPanel.value;
}

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
    if (payload.type === "model") {
      void refreshAvailableModels();
    }
    setTimeout(() => {
      if (downloadProgress.value?.id === payload.id) {
        downloadProgress.value = null;
      }
    }, 800);
  }
}

async function refreshAvailableModels() {
  const targetDir =
    (activeConfig.value?.fasterWhisperModelDir || "").trim() ||
    paths.value?.modelsDir ||
    modelsBaseDir.value;
  if (!targetDir) {
    availableModels.value = [];
    return;
  }
  modelsBaseDir.value = targetDir;
  try {
    const result = await window.usp.listFasterWhisperModels(targetDir);
    if (result?.ok && result.models) {
      availableModels.value = result.models;
      modelsBaseDir.value = result.baseDir || targetDir;
    }
  } catch (error) {
    console.error("Failed to list Faster-Whisper models", error);
  }
}

async function handleDownloadBinary(variant: "cpu" | "gpu") {
  if (isBusy.value) return;
  downloadMessage.value = "";
  downloadError.value = "";
  showDownloadPanel.value = true;
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
  showDownloadPanel.value = true;
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
    await refreshAvailableModels();
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
</script>
