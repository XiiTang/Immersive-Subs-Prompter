import { computed, ref, watch, type ComputedRef, type Ref, type WritableComputedRef } from "vue";
import type { TranscriptionConfig, TranscriptionPluginConfig } from "../../../../../main/types";
import { useDesktopStore } from "../../../../stores/desktop";
import { BASE_TRANSCRIPTION_CONFIG } from "../../../../../common/transcriptionDefaults";
import { TRANSCRIPTION_PLUGIN_ID } from "../../../../../common/pluginIds";

export interface UseTranscriptionConfigReturn {
  transcriptionConfigs: ComputedRef<TranscriptionConfig[]>;
  transcriptionPluginConfig: ComputedRef<TranscriptionPluginConfig>;
  activeConfigId: WritableComputedRef<string>;
  activeConfig: ComputedRef<TranscriptionConfig | null>;
  selectedConfigId: Ref<string>;
  selectedConfig: ComputedRef<TranscriptionConfig | null>;
  writePluginConfig: (config: TranscriptionPluginConfig) => void;
  updateConfig: (patch: Record<string, unknown>) => void;
  updateConfigById: (configId: string, patch: Record<string, unknown>) => void;
  handleAddConfig: () => void;
  handleDeleteConfig: () => void;
  provider: WritableComputedRef<string>;
  isWhisperApi: ComputedRef<boolean>;
  isFasterWhisper: ComputedRef<boolean>;
  baseUrl: WritableComputedRef<string>;
  apiKey: WritableComputedRef<string>;
  model: WritableComputedRef<string>;
  languageField: WritableComputedRef<string>;
  prompt: WritableComputedRef<string>;
  ytDlpArgs: WritableComputedRef<string>;
  extraParamsText: WritableComputedRef<string>;
  extraParamsError: Ref<string | null>;
  fasterWhisperBinary: WritableComputedRef<string>;
  fasterWhisperModel: WritableComputedRef<string>;
  fasterWhisperModelDir: WritableComputedRef<string>;
  fasterWhisperDevice: WritableComputedRef<"cpu" | "cuda">;
  fasterWhisperVadFilter: WritableComputedRef<boolean>;
  fasterWhisperVadThreshold: WritableComputedRef<number>;
  fasterWhisperVadMethod: WritableComputedRef<string>;
  fasterWhisperUseKim2: WritableComputedRef<boolean>;
}

function createTranscriptionConfigId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `transcription-${(crypto as Crypto).randomUUID()}`;
  }
  return `transcription-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function useTranscriptionConfig(
  t: (key: string, fallback: string) => string
): UseTranscriptionConfigReturn {
  const store = useDesktopStore();

  const transcriptionPluginConfig = computed<TranscriptionPluginConfig>(() =>
    store.getTranscriptionPluginConfig()
  );
  const transcriptionConfigs = computed(() => transcriptionPluginConfig.value.configs);

  function writePluginConfig(config: TranscriptionPluginConfig) {
    store.setPluginConfig(TRANSCRIPTION_PLUGIN_ID, config as unknown as Record<string, unknown>);
  }

  const activeConfigId = computed<string>({
    get: () => transcriptionPluginConfig.value.activeConfigId ?? transcriptionConfigs.value[0]?.id ?? "",
    set: (value: string) => {
      const nextActiveId = transcriptionConfigs.value.some((config) => config.id === value)
        ? value
        : transcriptionConfigs.value[0]?.id ?? null;
      writePluginConfig({
        ...transcriptionPluginConfig.value,
        activeConfigId: nextActiveId
      });
    }
  });

  const activeConfig = computed(
    () => transcriptionConfigs.value.find((config) => config.id === activeConfigId.value) ?? null
  );
  const selectedConfigId = ref("");
  const selectedConfig = computed(
    () =>
      transcriptionConfigs.value.find((config) => config.id === selectedConfigId.value) ??
      activeConfig.value ??
      transcriptionConfigs.value[0] ??
      null
  );

  function updateConfig(patch: Record<string, unknown>) {
    if (!selectedConfig.value) {
      return;
    }
    updateConfigById(selectedConfig.value.id, patch);
  }

  function updateConfigById(configId: string, patch: Record<string, unknown>) {
    writePluginConfig({
      ...transcriptionPluginConfig.value,
      configs: transcriptionConfigs.value.map((config) =>
        config.id === configId ? { ...config, ...patch } : config
      )
    });
  }

  function handleAddConfig() {
    const id = createTranscriptionConfigId();
    selectedConfigId.value = id;
    writePluginConfig({
      activeConfigId: activeConfigId.value || id,
      configs: [
        ...transcriptionConfigs.value,
        {
          id,
          ...BASE_TRANSCRIPTION_CONFIG
        }
      ]
    });
  }

  function handleDeleteConfig() {
    if (!selectedConfig.value) {
      return;
    }
    let configs = transcriptionConfigs.value.filter((config) => config.id !== selectedConfig.value?.id);
    if (!configs.length) {
      configs = [
        {
          id: createTranscriptionConfigId(),
          ...BASE_TRANSCRIPTION_CONFIG
        }
      ];
    }
    selectedConfigId.value = configs[0]?.id ?? "";
    const nextActiveConfigId = configs.some((config) => config.id === activeConfigId.value)
      ? activeConfigId.value
      : configs[0]?.id ?? null;
    writePluginConfig({
      activeConfigId: nextActiveConfigId,
      configs
    });
  }

  const provider = computed<string>({
    get: () => selectedConfig.value?.provider ?? "whisper-api",
    set: (value: string) => updateConfig({ provider: value })
  });

  const isWhisperApi = computed(() => provider.value === "whisper-api");
  const isFasterWhisper = computed(() => provider.value === "faster-whisper");

  const baseUrl = computed<string>({
    get: () => selectedConfig.value?.baseUrl ?? "",
    set: (value: string) => updateConfig({ baseUrl: value })
  });

  const apiKey = computed<string>({
    get: () => selectedConfig.value?.apiKey ?? "",
    set: (value: string) => updateConfig({ apiKey: value })
  });

  const model = computed<string>({
    get: () => selectedConfig.value?.model ?? "",
    set: (value: string) => updateConfig({ model: value })
  });

  const languageField = computed<string>({
    get: () => selectedConfig.value?.language ?? "",
    set: (value: string) => updateConfig({ language: value })
  });

  const prompt = computed<string>({
    get: () => selectedConfig.value?.prompt ?? "",
    set: (value: string) => updateConfig({ prompt: value })
  });

  const ytDlpArgs = computed<string>({
    get: () => selectedConfig.value?.ytDlpArgs ?? "",
    set: (value: string) => updateConfig({ ytDlpArgs: value })
  });

  const extraParamsError = ref<string | null>(null);

  const extraParamsText = computed<string>({
    get: () => JSON.stringify(selectedConfig.value?.extraParams ?? {}, null, 2),
    set: (value: string) => {
      if (!selectedConfig.value) {
        return;
      }
      const trimmed = value.trim();
      if (!trimmed.length) {
        updateConfig({ extraParams: {} });
        extraParamsError.value = null;
        return;
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          updateConfig({ extraParams: parsed as Record<string, string> });
          extraParamsError.value = null;
        } else {
          extraParamsError.value = t("transcription-extra-params-invalid", "Please enter a valid JSON object.");
        }
      } catch (error) {
        extraParamsError.value =
          error instanceof Error
            ? error.message
            : t("transcription-extra-params-invalid", "Please enter a valid JSON object.");
      }
    }
  });

  const fasterWhisperBinary = computed<string>({
    get: () => selectedConfig.value?.fasterWhisperBinary ?? "",
    set: (value: string) => updateConfig({ fasterWhisperBinary: value })
  });

  const fasterWhisperModel = computed<string>({
    get: () => selectedConfig.value?.fasterWhisperModel ?? "",
    set: (value: string) => updateConfig({ fasterWhisperModel: value })
  });

  const fasterWhisperModelDir = computed<string>({
    get: () => selectedConfig.value?.fasterWhisperModelDir ?? "",
    set: (value: string) => updateConfig({ fasterWhisperModelDir: value })
  });

  const fasterWhisperDevice = computed<"cpu" | "cuda">({
    get: () => selectedConfig.value?.fasterWhisperDevice ?? "cpu",
    set: (value: "cpu" | "cuda") => updateConfig({ fasterWhisperDevice: value })
  });

  const fasterWhisperVadFilter = computed<boolean>({
    get: () => selectedConfig.value?.fasterWhisperVadFilter ?? true,
    set: (value: boolean) => updateConfig({ fasterWhisperVadFilter: value })
  });

  const fasterWhisperVadThreshold = computed<number>({
    get: () => selectedConfig.value?.fasterWhisperVadThreshold ?? 0.5,
    set: (value: number) => {
      const current = selectedConfig.value?.fasterWhisperVadThreshold ?? 0.5;
      const normalized = Number.isFinite(value) ? value : current;
      updateConfig({ fasterWhisperVadThreshold: normalized });
    }
  });

  const fasterWhisperVadMethod = computed<string>({
    get: () => selectedConfig.value?.fasterWhisperVadMethod ?? "",
    set: (value: string) => updateConfig({ fasterWhisperVadMethod: value })
  });

  const fasterWhisperUseKim2 = computed<boolean>({
    get: () => selectedConfig.value?.fasterWhisperUseKim2 ?? false,
    set: (value: boolean) => updateConfig({ fasterWhisperUseKim2: value })
  });

  watch(selectedConfig, (config) => {
    selectedConfigId.value = config?.id ?? "";
    extraParamsError.value = null;
  }, { immediate: true });

  return {
    transcriptionConfigs,
    transcriptionPluginConfig,
    activeConfigId,
    activeConfig,
    selectedConfigId,
    selectedConfig,
    writePluginConfig,
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
  };
}
