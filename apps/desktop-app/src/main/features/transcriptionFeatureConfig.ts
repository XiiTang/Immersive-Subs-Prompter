import type { TranscriptionConfig, TranscriptionFeatureSettings } from "../types.js";

export function buildFeatureTranscriptionConfig(settings: TranscriptionFeatureSettings): TranscriptionConfig {
  const active = settings.configs.find((config) => config.id === settings.activeConfigId);
  if (!active) {
    throw new Error("Active transcription config is not available.");
  }
  if (!active.enabled) {
    throw new Error("Active transcription config is disabled.");
  }
  return {
    ...active,
    extraParams: { ...active.extraParams }
  };
}
