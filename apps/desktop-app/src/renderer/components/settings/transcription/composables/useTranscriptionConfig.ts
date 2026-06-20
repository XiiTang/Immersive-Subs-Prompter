import { computed, ref, watch, type ComputedRef, type Ref, type WritableComputedRef } from "vue";
import type { TranscriptionConfig } from "../../../../../main/types";
import { BASE_TRANSCRIPTION_CONFIG } from "../../../../../common/transcriptionDefaults";
import { useDesktopStore } from "../../../../stores/desktop";

export interface UseTranscriptionConfigReturn {
  transcriptionConfigs: ComputedRef<TranscriptionConfig[]>;
  activeConfigId: ComputedRef<string>;
  selectedConfigId: Ref<string>;
  selectedConfig: ComputedRef<TranscriptionConfig | null>;
  selectConfig: (id: string) => void;
  updateConfig: (patch: Partial<TranscriptionConfig>) => void;
  renameConfig: (id: string, name: string) => void;
  toggleConfigEnabled: (id: string, enabled: boolean) => void;
  reorderConfig: (fromIndex: number, toIndex: number) => void;
  handleAddConfig: () => void;
  handleDuplicateConfig: () => void;
  handleDeleteConfig: () => void;
  extraParamsText: WritableComputedRef<string>;
  extraParamsError: Ref<string | null>;
}

function createTranscriptionConfigId() {
  return `transcription-${crypto.randomUUID()}`;
}

function createTranscriptionConfig(): TranscriptionConfig {
  return {
    id: createTranscriptionConfigId(),
    ...BASE_TRANSCRIPTION_CONFIG,
    extraParams: { ...BASE_TRANSCRIPTION_CONFIG.extraParams }
  };
}

export function useTranscriptionConfig(t: (key: string) => string): UseTranscriptionConfigReturn {
  const store = useDesktopStore();
  const extraParamsError = ref<string | null>(null);
  const transcriptionFeature = computed(() => store.settings?.features.transcription ?? null);
  const transcriptionConfigs = computed(() => transcriptionFeature.value?.configs ?? []);
  const activeConfigId = computed(() => transcriptionFeature.value?.activeConfigId ?? "");
  const selectedConfigId = ref("");
  const selectedConfig = computed(() =>
    transcriptionConfigs.value.find((config) => config.id === selectedConfigId.value) ?? null
  );

  watch(
    [transcriptionConfigs, activeConfigId],
    () => {
      if (!transcriptionConfigs.value.length) {
        selectedConfigId.value = "";
        return;
      }
      if (transcriptionConfigs.value.some((config) => config.id === selectedConfigId.value)) {
        return;
      }
      selectedConfigId.value = transcriptionConfigs.value.some((config) => config.id === activeConfigId.value)
        ? activeConfigId.value
        : transcriptionConfigs.value[0]!.id;
    },
    { immediate: true }
  );

  watch(selectedConfigId, () => {
    extraParamsError.value = null;
  });

  function selectConfig(id: string) {
    if (transcriptionConfigs.value.some((config) => config.id === id)) {
      selectedConfigId.value = id;
    }
  }

  function writeConfigs(configs: TranscriptionConfig[], nextActiveId = activeConfigId.value) {
    const resolvedActiveId = configs.some((config) => config.id === nextActiveId)
      ? nextActiveId
      : configs[0]?.id;
    if (resolvedActiveId) {
      void store.setTranscriptionConfigs(configs, resolvedActiveId);
    }
  }

  function updateConfig(patch: Partial<TranscriptionConfig>) {
    if (!selectedConfig.value) {
      return;
    }
    const currentId = selectedConfig.value.id;
    const hasExtraParamsPatch = Object.prototype.hasOwnProperty.call(patch, "extraParams");
    writeConfigs(
      transcriptionConfigs.value.map((config) =>
        config.id === currentId
          ? {
              ...config,
              ...patch,
              extraParams: hasExtraParamsPatch ? { ...(patch.extraParams ?? {}) } : { ...config.extraParams }
            }
          : config
      )
    );
  }

  function renameConfig(id: string, name: string) {
    const trimmedName = name.trim();
    if (!trimmedName || !transcriptionConfigs.value.some((config) => config.id === id)) {
      return;
    }
    writeConfigs(
      transcriptionConfigs.value.map((config) =>
        config.id === id ? { ...config, name: trimmedName } : config
      )
    );
  }

  function handleAddConfig() {
    const next = createTranscriptionConfig();
    const activeStillEnabled = transcriptionConfigs.value.some(
      (config) => config.id === activeConfigId.value && config.enabled
    );
    writeConfigs(
      [...transcriptionConfigs.value, next],
      activeStillEnabled ? activeConfigId.value : next.id
    );
    selectedConfigId.value = next.id;
  }

  function handleDuplicateConfig() {
    if (!selectedConfig.value) {
      return;
    }
    const source = selectedConfig.value;
    const sourceIndex = transcriptionConfigs.value.findIndex((config) => config.id === source.id);
    const copy: TranscriptionConfig = {
      ...source,
      id: createTranscriptionConfigId(),
      name: `${source.name} Copy`,
      extraParams: { ...source.extraParams }
    };
    writeConfigs([
      ...transcriptionConfigs.value.slice(0, sourceIndex + 1),
      copy,
      ...transcriptionConfigs.value.slice(sourceIndex + 1)
    ]);
    selectedConfigId.value = copy.id;
  }

  function handleDeleteConfig() {
    if (!selectedConfig.value) {
      return;
    }
    const currentId = selectedConfig.value.id;
    const currentIndex = transcriptionConfigs.value.findIndex((config) => config.id === currentId);
    let nextConfigs = transcriptionConfigs.value.filter((config) => config.id !== currentId);
    if (!nextConfigs.length) {
      nextConfigs = [createTranscriptionConfig()];
    }
    const nextSelectedId = nextConfigs[Math.min(Math.max(currentIndex, 0), nextConfigs.length - 1)]!.id;
    const nextActiveId = currentId === activeConfigId.value ? nextConfigs[0]!.id : activeConfigId.value;
    selectedConfigId.value = nextSelectedId;
    writeConfigs(nextConfigs, nextActiveId);
  }

  function toggleConfigEnabled(id: string, enabled: boolean) {
    if (transcriptionConfigs.value.some((config) => config.id === id)) {
      void store.toggleTranscriptionConfigEnabled(id, enabled);
    }
  }

  function reorderConfig(fromIndex: number, toIndex: number) {
    void store.reorderTranscriptionConfig(fromIndex, toIndex);
  }

  const extraParamsText = computed({
    get: () => JSON.stringify(selectedConfig.value?.extraParams ?? {}, null, 2),
    set: (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) {
        updateConfig({ extraParams: {} });
        extraParamsError.value = null;
        return;
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          extraParamsError.value = t("feature-transcription-extra-params-invalid");
          return;
        }
        const params: Record<string, string> = {};
        for (const [key, raw] of Object.entries(parsed)) {
          if (typeof raw !== "string") {
            extraParamsError.value = t("feature-transcription-extra-params-invalid");
            return;
          }
          params[key] = raw;
        }
        updateConfig({ extraParams: params });
        extraParamsError.value = null;
      } catch (error) {
        extraParamsError.value = error instanceof Error ? error.message : t("feature-transcription-extra-params-invalid");
      }
    }
  });

  return {
    transcriptionConfigs,
    activeConfigId,
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
  };
}
