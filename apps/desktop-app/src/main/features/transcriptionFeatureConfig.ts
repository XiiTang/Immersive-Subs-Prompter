import type { TranscriptionConfig, TranscriptionFeatureConfig } from "../types.js";

function stringField(
  config: TranscriptionFeatureConfig,
  key: keyof TranscriptionFeatureConfig,
  fieldName: string
): string {
  const value = config[key];
  if (typeof value !== "string") {
    throw new Error(`Transcription ${fieldName} must be a string.`);
  }
  return value;
}

function booleanField(
  config: TranscriptionFeatureConfig,
  key: keyof TranscriptionFeatureConfig,
  fieldName: string
): boolean {
  const value = config[key];
  if (typeof value !== "boolean") {
    throw new Error(`Transcription ${fieldName} must be a boolean.`);
  }
  return value;
}

function numberField(
  config: TranscriptionFeatureConfig,
  key: keyof TranscriptionFeatureConfig,
  fieldName: string
): number {
  const value = config[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Transcription ${fieldName} must be a finite number.`);
  }
  return value;
}

function providerValue(config: TranscriptionFeatureConfig): TranscriptionConfig["provider"] {
  const value = config.provider;
  if (value === "whisper-api" || value === "faster-whisper") {
    return value;
  }
  throw new Error("Transcription provider must be whisper-api or faster-whisper.");
}

function deviceValue(config: TranscriptionFeatureConfig): TranscriptionConfig["fasterWhisperDevice"] {
  const value = config.fasterWhisperDevice;
  if (value === "cpu" || value === "cuda") {
    return value;
  }
  throw new Error("Transcription faster-whisper device must be cpu or cuda.");
}

function parseExtraParamsJson(config: TranscriptionFeatureConfig): Record<string, string> {
  const raw = stringField(config, "extraParamsJson", "extra params JSON").trim();
  if (!raw) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Transcription extra params must be valid JSON: ${message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Transcription extra params must be a JSON object.");
  }
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (!key.trim() || key !== key.trim()) {
      throw new Error("Transcription extra params keys must be non-empty strings without edge whitespace.");
    }
    if (typeof value !== "string") {
      throw new Error(`Transcription extra param "${key}" must be a string.`);
    }
    params[key] = value;
  }
  return params;
}

export function buildFeatureTranscriptionConfig(config: TranscriptionFeatureConfig): TranscriptionConfig {
  return {
    id: "feature-transcription",
    name: "Speech Transcription",
    provider: providerValue(config),
    baseUrl: stringField(config, "baseUrl", "API base URL"),
    apiKey: stringField(config, "apiKey", "API key"),
    model: stringField(config, "model", "model"),
    language: stringField(config, "language", "language"),
    prompt: stringField(config, "prompt", "prompt"),
    enableWordTimestamps: booleanField(config, "enableWordTimestamps", "word timestamps"),
    extraParams: parseExtraParamsJson(config),
    fasterWhisperModel: stringField(config, "fasterWhisperModel", "faster-whisper model"),
    fasterWhisperModelDir: stringField(config, "fasterWhisperModelDir", "faster-whisper model directory"),
    fasterWhisperDevice: deviceValue(config),
    fasterWhisperVadFilter: booleanField(config, "fasterWhisperVadFilter", "faster-whisper VAD filter"),
    fasterWhisperVadThreshold: numberField(config, "fasterWhisperVadThreshold", "faster-whisper VAD threshold"),
    fasterWhisperVadMethod: stringField(config, "fasterWhisperVadMethod", "faster-whisper VAD method"),
    fasterWhisperUseKim2: booleanField(config, "fasterWhisperUseKim2", "faster-whisper Kim2")
  };
}
