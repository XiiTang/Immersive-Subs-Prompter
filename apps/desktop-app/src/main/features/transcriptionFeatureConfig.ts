import type { TranscriptionConfig, TranscriptionFeatureSettings } from "../types.js";

export function buildFeatureTranscriptionConfig(settings: TranscriptionFeatureSettings): TranscriptionConfig {
  const active = settings.configs.find((config) => config.id === settings.activeConfigId);
  if (!active) {
    throw new Error("Active transcription config is not available.");
  }
  return {
    ...active,
    extraParams: { ...active.extraParams }
  };
}
