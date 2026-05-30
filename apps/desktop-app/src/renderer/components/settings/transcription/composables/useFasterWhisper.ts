import { computed, onWatcherCleanup, ref, watch, type ComputedRef, type Ref, type WritableComputedRef } from "vue";
import type { TranscriptionConfig } from "../../../../../main/types";
import { reportError } from "../../../../utils/errorBus";
import { normalizeFasterWhisperModelName } from "../../../../../common/fasterWhisperModels";

export interface FasterWhisperPaths {
  binaryDir: string;
  modelsDir: string;
  cpuBinaryPath: string;
  gpuBinaryPath: string;
}

export interface AvailableModel {
  name: string;
  path: string;
  folder: string;
}

export interface DownloadProgress {
  id: string;
  type: "binary" | "model";
  variant?: "cpu" | "gpu";
  model?: string;
  percent: number;
  status: string;
}

export interface UseFasterWhisperOptions {
  t: (key: string, fallback: string) => string;
  activeConfig: ComputedRef<TranscriptionConfig | null>;
  isFasterWhisper: ComputedRef<boolean>;
  updateConfig: (patch: Record<string, unknown>) => void;
  fasterWhisperModel: WritableComputedRef<string>;
  fasterWhisperModelDir: WritableComputedRef<string>;
}

export interface UseFasterWhisperReturn {
  paths: Ref<FasterWhisperPaths | null>;
  selectedModel: Ref<string>;
  isBusy: Ref<boolean>;
  downloadMessage: Ref<string>;
  downloadError: Ref<string>;
  availableModels: Ref<AvailableModel[]>;
  modelsBaseDir: Ref<string>;
  customModelInput: Ref<string>;
  binaryStatus: Ref<{ cpu: boolean; gpu: boolean }>;
  binaryDownloadsSupported: Ref<boolean>;
  binaryDownloadUnsupportedReason: Ref<string | null>;
  downloadProgress: Ref<DownloadProgress | null>;
  activeJobId: Ref<string | null>;
  selectedDownloadedModel: WritableComputedRef<string>;
  initializeFasterWhisper: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  handleDownloadBinary: (variant: "cpu" | "gpu") => Promise<void>;
  handleDownloadModel: () => Promise<void>;
  openPath: (target?: string | null) => Promise<void>;
}

function createJobId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${(crypto as Crypto).randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function useFasterWhisper(options: UseFasterWhisperOptions): UseFasterWhisperReturn {
  const { t, activeConfig, isFasterWhisper, updateConfig, fasterWhisperModel, fasterWhisperModelDir } = options;

  const paths = ref<FasterWhisperPaths | null>(null);
  const selectedModel = ref("tiny");
  const isBusy = ref(false);
  const downloadMessage = ref("");
  const downloadError = ref("");
  const availableModels = ref<AvailableModel[]>([]);
  const modelsBaseDir = ref("");
  const customModelInput = ref("");
  const binaryStatus = ref({ cpu: false, gpu: false });
  const binaryDownloadsSupported = ref(true);
  const binaryDownloadUnsupportedReason = ref<string | null>(null);
  const downloadProgress = ref<DownloadProgress | null>(null);
  const activeJobId = ref<string | null>(null);
  let unsubscribeDownloadProgress: (() => void) | null = null;

  function shouldUseFasterWhisper() {
    return isFasterWhisper.value && !!activeConfig.value;
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

  function handleDownloadProgress(payload: DownloadProgress) {
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
      reportError(error, "fasterWhisper.loadPaths");
    }
    await refreshStatus();
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
      binaryDownloadsSupported.value = status.binaryDownloadsSupported;
      binaryDownloadUnsupportedReason.value = status.binaryDownloadUnsupportedReason;
      binaryStatus.value = {
        cpu: !!status.binaries?.cpu?.exists,
        gpu: !!status.binaries?.gpu?.exists
      };
      if (status.models) {
        availableModels.value = status.models;
      }
      modelsBaseDir.value =
        status.modelsBaseDir || status.paths?.modelsDir || targetDir || modelsBaseDir.value;
    } catch (error) {
      reportError(error, "fasterWhisper.refreshStatus");
    }
  }

  async function handleDownloadBinary(variant: "cpu" | "gpu") {
    if (isBusy.value) return;
    downloadMessage.value = "";
    downloadError.value = "";
    if (!binaryDownloadsSupported.value) {
      downloadError.value =
        binaryDownloadUnsupportedReason.value ||
        t("transcription-faster-binary-download-windows-only", "Managed binary downloads are only available on Windows.");
      return;
    }
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
      downloadMessage.value = t("transcription-faster-model-success", "Model downloaded to: ") + result.path;
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

  watch(
    [isFasterWhisper, activeConfig],
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

  const selectedDownloadedModel = computed<string>({
    get: () => {
      const current = fasterWhisperModel.value;
      if (!current) {
        return availableModels.value.length ? availableModels.value[0].name : "custom";
      }
      const normalized = normalizeFasterWhisperModelName(current);
      const match = availableModels.value.find(
        (entry) => entry.name === normalized || entry.folder === current || entry.path === current
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

  return {
    paths,
    selectedModel,
    isBusy,
    downloadMessage,
    downloadError,
    availableModels,
    modelsBaseDir,
    customModelInput,
    binaryStatus,
    binaryDownloadsSupported,
    binaryDownloadUnsupportedReason,
    downloadProgress,
    activeJobId,
    selectedDownloadedModel,
    initializeFasterWhisper,
    refreshStatus,
    handleDownloadBinary,
    handleDownloadModel,
    openPath
  };
}
