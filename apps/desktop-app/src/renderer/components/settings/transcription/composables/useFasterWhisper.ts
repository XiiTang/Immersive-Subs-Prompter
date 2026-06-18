import { computed, onMounted, onUnmounted, ref, watch, type ComputedRef } from "vue";
import type { TranscriptionConfig } from "../../../../../main/types";

type UpdateConfig = (patch: Partial<TranscriptionConfig>) => void;
type BinaryVariant = "cpu" | "gpu";

interface FasterWhisperPaths {
  binaryDir: string;
  modelsDir: string;
  cpuBinaryPath: string;
  gpuBinaryPath: string;
}

interface DownloadedModel {
  name: string;
  path: string;
  folder: string;
}

interface FasterWhisperStatus {
  ok: boolean;
  paths: FasterWhisperPaths;
  binaries: {
    cpu: {
      exists: boolean;
      path: string;
      downloadSupported: boolean;
      downloadUnavailableReason: string | null;
    };
    gpu: {
      exists: boolean;
      path: string;
      downloadSupported: boolean;
      downloadUnavailableReason: string | null;
    };
  };
  models: DownloadedModel[];
  modelsBaseDir: string;
  error?: string;
}

interface DownloadProgress {
  id: string;
  percent: number;
  status: string;
}

export function useFasterWhisper(
  activeConfig: ComputedRef<TranscriptionConfig | null>,
  updateConfig: UpdateConfig
) {
  const status = ref<FasterWhisperStatus | null>(null);
  const paths = ref<FasterWhisperPaths | null>(null);
  const availableModels = ref<DownloadedModel[]>([]);
  const modelsBaseDir = ref("");
  const selectedDownloadedModel = ref("");
  const customModelInput = ref("");
  const isBusy = ref(false);
  const downloadProgress = ref(0);
  const downloadMessage = ref("");
  const downloadError = ref<string | null>(null);
  let unsubscribeDownloadProgress: (() => void) | null = null;
  let isMounted = false;

  const binaryStatus = computed(() => status.value?.binaries ?? null);
  const selectedModel = computed(() =>
    selectedDownloadedModel.value || customModelInput.value || activeConfig.value?.fasterWhisperModel || ""
  );

  function syncModelInputs() {
    const model = activeConfig.value?.fasterWhisperModel ?? "";
    if (!model) {
      selectedDownloadedModel.value = "";
      customModelInput.value = "";
      return;
    }
    if (availableModels.value.some((availableModel) => availableModel.name === model)) {
      selectedDownloadedModel.value = model;
      customModelInput.value = "";
      return;
    }
    selectedDownloadedModel.value = "";
    customModelInput.value = model;
  }

  async function refreshStatus() {
    const result = await window.usp.getFasterWhisperStatus(
      activeConfig.value?.id ? { configId: activeConfig.value.id } : undefined
    );
    if (!result.ok) {
      downloadError.value = result.error;
      return;
    }
    status.value = result;
    paths.value = result.paths;
    availableModels.value = result.models;
    modelsBaseDir.value = result.modelsBaseDir;
    syncModelInputs();
    downloadError.value = null;
  }

  function handleDownloadProgress(payload: DownloadProgress) {
    downloadProgress.value = payload.percent;
    downloadMessage.value = payload.status;
  }

  async function handleDownloadBinary(variant: BinaryVariant) {
    isBusy.value = true;
    downloadProgress.value = 0;
    downloadError.value = null;
    const binary = binaryStatus.value?.[variant];
    if (binary && !binary.downloadSupported) {
      downloadError.value = binary.downloadUnavailableReason;
      isBusy.value = false;
      return;
    }
    try {
      const result = await window.usp.downloadFasterWhisperBinary({
        variant,
        jobId: `fw-bin-${crypto.randomUUID()}`
      });
      if (!result.ok) {
        downloadError.value = result.error;
        return;
      }
      updateConfig({ fasterWhisperBinary: result.path });
      await refreshStatus();
    } finally {
      isBusy.value = false;
    }
  }

  async function handleDownloadModel(modelName = selectedModel.value) {
    const model = modelName.trim();
    if (!model) {
      return;
    }
    isBusy.value = true;
    downloadProgress.value = 0;
    downloadError.value = null;
    try {
      const result = await window.usp.downloadFasterWhisperModel({
        model,
        ...(activeConfig.value?.id ? { configId: activeConfig.value.id } : {}),
        jobId: `fw-model-${crypto.randomUUID()}`
      });
      if (!result.ok) {
        downloadError.value = result.error;
        return;
      }
      updateConfig({
        fasterWhisperModel: model,
        fasterWhisperModelDir: result.baseDir
      });
      await refreshStatus();
    } finally {
      isBusy.value = false;
    }
  }

  async function openBinaryFolder() {
    await window.usp.openFasterWhisperBinaryFolder();
  }

  async function openModelsFolder() {
    await window.usp.openFasterWhisperModelsFolder(
      activeConfig.value?.id ? { configId: activeConfig.value.id } : undefined
    );
  }

  onMounted(() => {
    isMounted = true;
    unsubscribeDownloadProgress = window.usp.onFasterWhisperDownloadProgress(handleDownloadProgress);
    void refreshStatus();
  });

  onUnmounted(() => {
    isMounted = false;
    unsubscribeDownloadProgress?.();
  });

  watch(
    [() => activeConfig.value?.id, () => activeConfig.value?.fasterWhisperModel, availableModels],
    syncModelInputs,
    { immediate: true }
  );

  watch(
    () => activeConfig.value?.fasterWhisperModelDir,
    () => {
      if (isMounted) {
        void refreshStatus();
      }
    }
  );

  return {
    status,
    paths,
    binaryStatus,
    availableModels,
    modelsBaseDir,
    selectedModel,
    selectedDownloadedModel,
    customModelInput,
    isBusy,
    downloadProgress,
    downloadMessage,
    downloadError,
    refreshStatus,
    handleDownloadBinary,
    handleDownloadModel,
    openBinaryFolder,
    openModelsFolder
  };
}
