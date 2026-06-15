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

function requiredTrimmedString(
  config: TranscriptionFeatureConfig,
  key: keyof TranscriptionFeatureConfig,
  fieldName: string
): string {
  const value = stringField(config, key, fieldName).trim();
  if (!value) {
    throw new Error(`Transcription ${fieldName} is required.`);
  }
  return value;
}

function requireHttpUrl(value: string, fieldName: string): void {
  if (!URL.canParse(value)) {
    throw new Error(`Transcription ${fieldName} must be a valid HTTP(S) URL.`);
  }
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Transcription ${fieldName} must be a valid HTTP(S) URL.`);
  }
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
  const provider = providerValue(config);
  const baseUrl = provider === "whisper-api"
    ? requiredTrimmedString(config, "baseUrl", "API base URL")
    : stringField(config, "baseUrl", "API base URL").trim();
  if (provider === "whisper-api") {
    requireHttpUrl(baseUrl, "API base URL");
  }
  const model = provider === "whisper-api"
    ? requiredTrimmedString(config, "model", "model")
    : stringField(config, "model", "model").trim();
  const fasterWhisperModel = provider === "faster-whisper"
    ? requiredTrimmedString(config, "fasterWhisperModel", "faster-whisper model")
    : stringField(config, "fasterWhisperModel", "faster-whisper model").trim();

  return {
    id: "feature-transcription",
    name: "Speech Transcription",
    provider,
    baseUrl,
    apiKey: stringField(config, "apiKey", "API key"),
    model,
    language: stringField(config, "language", "language"),
    prompt: stringField(config, "prompt", "prompt"),
    enableWordTimestamps: booleanField(config, "enableWordTimestamps", "word timestamps"),
    extraParams: parseExtraParamsJson(config),
    fasterWhisperModel,
    fasterWhisperModelDir: stringField(config, "fasterWhisperModelDir", "faster-whisper model directory"),
    fasterWhisperDevice: deviceValue(config),
    fasterWhisperVadFilter: booleanField(config, "fasterWhisperVadFilter", "faster-whisper VAD filter"),
    fasterWhisperVadThreshold: numberField(config, "fasterWhisperVadThreshold", "faster-whisper VAD threshold"),
    fasterWhisperVadMethod: stringField(config, "fasterWhisperVadMethod", "faster-whisper VAD method"),
    fasterWhisperUseKim2: booleanField(config, "fasterWhisperUseKim2", "faster-whisper Kim2")
  };
}
