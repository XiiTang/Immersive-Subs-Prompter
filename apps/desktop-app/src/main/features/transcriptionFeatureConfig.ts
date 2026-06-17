import type { TranscriptionConfig, TranscriptionFeatureSettings } from "../types.js";

function requireHttpUrl(value: string, fieldName: string): void {
  if (!URL.canParse(value)) {
    throw new Error(`Transcription ${fieldName} must be a valid HTTP(S) URL.`);
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Transcription ${fieldName} must be a valid HTTP(S) URL.`);
  }
}

function stringField(config: Record<string, unknown>, key: string, fieldName: string): string {
  const value = config[key];
  if (typeof value !== "string") {
    throw new Error(`Transcription ${fieldName} must be a string.`);
  }
  return value;
}

function requireTrimmed(config: Record<string, unknown>, key: string, fieldName: string): string {
  const trimmed = stringField(config, key, fieldName).trim();
  if (!trimmed) {
    throw new Error(`Transcription ${fieldName} is required.`);
  }
  return trimmed;
}

function booleanField(config: Record<string, unknown>, key: string, fieldName: string): boolean {
  const value = config[key];
  if (typeof value !== "boolean") {
    throw new Error(`Transcription ${fieldName} must be a boolean.`);
  }
  return value;
}

function numberField(config: Record<string, unknown>, key: string, fieldName: string): number {
  const value = config[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Transcription ${fieldName} must be a finite number.`);
  }
  return value;
}

function providerValue(config: Record<string, unknown>): TranscriptionConfig["provider"] {
  const value = config.provider;
  if (value === "whisper-api" || value === "faster-whisper") {
    return value;
  }
  throw new Error("Transcription provider must be whisper-api or faster-whisper.");
}

function deviceValue(config: Record<string, unknown>): TranscriptionConfig["fasterWhisperDevice"] {
  const value = config.fasterWhisperDevice;
  if (value === "cpu" || value === "cuda") {
    return value;
  }
  throw new Error("Transcription faster-whisper device must be cpu or cuda.");
}

function extraParamsValue(config: Record<string, unknown>): Record<string, string> {
  const value = config.extraParams;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Transcription extra params must be an object.");
  }
  const params: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (!key.trim() || key !== key.trim()) {
      throw new Error("Transcription extra params keys must be non-empty strings without edge whitespace.");
    }
    if (typeof item !== "string") {
      throw new Error(`Transcription extra param "${key}" must be a string.`);
    }
    params[key] = item;
  }
  return params;
}

function cloneAndValidateConfig(input: TranscriptionConfig): TranscriptionConfig {
  const record = input as unknown as Record<string, unknown>;
  const provider = providerValue(record);
  const config: TranscriptionConfig = {
    id: requireTrimmed(record, "id", "config id"),
    name: requireTrimmed(record, "name", "config name"),
    provider,
    baseUrl: stringField(record, "baseUrl", "API base URL"),
    apiKey: stringField(record, "apiKey", "API key"),
    model: stringField(record, "model", "model"),
    language: stringField(record, "language", "language"),
    prompt: stringField(record, "prompt", "prompt"),
    enableWordTimestamps: booleanField(record, "enableWordTimestamps", "word timestamps"),
    extraParams: extraParamsValue(record),
    ytDlpArgs: stringField(record, "ytDlpArgs", "yt-dlp args"),
    fasterWhisperBinary: stringField(record, "fasterWhisperBinary", "faster-whisper executable"),
    fasterWhisperModel: stringField(record, "fasterWhisperModel", "faster-whisper model"),
    fasterWhisperModelDir: stringField(record, "fasterWhisperModelDir", "faster-whisper model directory"),
    fasterWhisperDevice: deviceValue(record),
    fasterWhisperVadFilter: booleanField(record, "fasterWhisperVadFilter", "faster-whisper VAD filter"),
    fasterWhisperVadThreshold: numberField(record, "fasterWhisperVadThreshold", "faster-whisper VAD threshold"),
    fasterWhisperVadMethod: stringField(record, "fasterWhisperVadMethod", "faster-whisper VAD method"),
    fasterWhisperUseKim2: booleanField(record, "fasterWhisperUseKim2", "faster-whisper Kim2")
  };

  if (config.provider === "whisper-api") {
    config.baseUrl = requireTrimmed(record, "baseUrl", "API base URL");
    requireHttpUrl(config.baseUrl, "API base URL");
    config.model = requireTrimmed(record, "model", "model");
  } else if (config.provider === "faster-whisper") {
    config.fasterWhisperModel = requireTrimmed(record, "fasterWhisperModel", "faster-whisper model");
    config.fasterWhisperBinary = requireTrimmed(record, "fasterWhisperBinary", "faster-whisper executable");
  }

  return config;
}

export function buildFeatureTranscriptionConfig(settings: TranscriptionFeatureSettings): TranscriptionConfig {
  const activeConfigId = settings.activeConfigId;
  const active = activeConfigId
    ? settings.configs.find((config) => config.id === activeConfigId)
    : null;
  if (!active) {
    throw new Error("Active transcription config is not available.");
  }
  return cloneAndValidateConfig(active);
}
