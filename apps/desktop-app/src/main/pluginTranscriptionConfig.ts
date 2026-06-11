import type { TranscriptionConfig } from "./types.js";

function stringField(config: Record<string, unknown>, key: string, defaultValue: string, fieldName: string): string {
  const value = config[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== "string") {
    throw new Error(`Transcription ${fieldName} must be a string.`);
  }
  return value;
}

function booleanField(config: Record<string, unknown>, key: string, defaultValue: boolean, fieldName: string): boolean {
  const value = config[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value !== "boolean") {
    throw new Error(`Transcription ${fieldName} must be a boolean.`);
  }
  return value;
}

function numberField(config: Record<string, unknown>, key: string, defaultValue: number, fieldName: string): number {
  const value = config[key];
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Transcription ${fieldName} must be a finite number.`);
  }
  return numeric;
}

function providerValue(config: Record<string, unknown>): TranscriptionConfig["provider"] {
  const value = config.provider;
  if (value === undefined || value === null || value === "") {
    return "whisper-api";
  }
  if (value === "whisper-api" || value === "faster-whisper") {
    return value;
  }
  throw new Error("Transcription provider must be whisper-api or faster-whisper.");
}

function deviceValue(config: Record<string, unknown>): TranscriptionConfig["fasterWhisperDevice"] {
  const value = config.fasterWhisperDevice;
  if (value === undefined || value === null || value === "") {
    return "cpu";
  }
  if (value === "cpu" || value === "cuda") {
    return value;
  }
  throw new Error("Transcription faster-whisper device must be cpu or cuda.");
}

function parseExtraParamsJson(config: Record<string, unknown>): Record<string, string> {
  const raw = stringField(config, "extraParamsJson", "{}", "extra params JSON").trim();
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

export function buildPluginTranscriptionConfig(config: Record<string, unknown>): TranscriptionConfig {
  return {
    id: "plugin-transcription",
    name: "Plugin Transcription",
    provider: providerValue(config),
    baseUrl: stringField(config, "baseUrl", "", "API base URL"),
    apiKey: stringField(config, "apiKey", "", "API key"),
    model: stringField(config, "model", "whisper-1", "model"),
    language: stringField(config, "language", "", "language"),
    prompt: stringField(config, "prompt", "", "prompt"),
    enableWordTimestamps: booleanField(config, "enableWordTimestamps", false, "word timestamps"),
    extraParams: parseExtraParamsJson(config),
    ytDlpArgs: "",
    fasterWhisperBinary: "",
    fasterWhisperModel: stringField(config, "fasterWhisperModel", "base", "faster-whisper model"),
    fasterWhisperModelDir: stringField(config, "fasterWhisperModelDir", "", "faster-whisper model directory"),
    fasterWhisperDevice: deviceValue(config),
    fasterWhisperVadFilter: booleanField(config, "fasterWhisperVadFilter", true, "faster-whisper VAD filter"),
    fasterWhisperVadThreshold: numberField(config, "fasterWhisperVadThreshold", 0.5, "faster-whisper VAD threshold"),
    fasterWhisperVadMethod: stringField(config, "fasterWhisperVadMethod", "", "faster-whisper VAD method"),
    fasterWhisperUseKim2: booleanField(config, "fasterWhisperUseKim2", false, "faster-whisper Kim2")
  };
}
