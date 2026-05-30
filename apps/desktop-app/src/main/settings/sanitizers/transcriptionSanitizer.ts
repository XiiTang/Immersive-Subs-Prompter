import type { TranscriptionConfig } from "../../types.js";
import { assertNoUnknownKeys } from "../utils.js";

const TRANSCRIPTION_PLUGIN_CONFIG_KEYS = ["activeConfigId", "configs"] as const;
const TRANSCRIPTION_CONFIG_KEYS = [
  "id",
  "name",
  "provider",
  "baseUrl",
  "apiKey",
  "model",
  "language",
  "prompt",
  "enableWordTimestamps",
  "extraParams",
  "ytDlpArgs",
  "fasterWhisperBinary",
  "fasterWhisperModel",
  "fasterWhisperModelDir",
  "fasterWhisperDevice",
  "fasterWhisperVadFilter",
  "fasterWhisperVadThreshold",
  "fasterWhisperVadMethod",
  "fasterWhisperUseKim2"
] as const;

export function validateTranscriptionPluginConfigForUpdate(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("transcription config must use the current object setting");
  }

  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, TRANSCRIPTION_PLUGIN_CONFIG_KEYS, "transcription");
  if (typeof source.activeConfigId !== "string") {
    throw new Error("transcription.activeConfigId must use the current string setting");
  }

  const configs = source.configs;
  if (!Array.isArray(configs)) {
    throw new Error("transcription.configs must use the current array setting");
  }
  if (!configs.length) {
    throw new Error("transcription.configs must include at least one current config");
  }

  const configIds = new Set<string>();
  for (const config of configs) {
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error("transcription config entries must use the current object setting");
    }
    const record = config as Record<string, unknown>;
    assertNoUnknownKeys(record, TRANSCRIPTION_CONFIG_KEYS, "transcription config");
    validateTranscriptionStringField(record, "id");
    const id = record.id as string;
    if (!id.trim()) {
      throw new Error("transcription.id must use the current non-empty string setting");
    }
    if (configIds.has(id)) {
      throw new Error(`duplicate transcription config id: ${id}`);
    }
    configIds.add(id);
    validateTranscriptionStringField(record, "name");
    if (record.provider !== "whisper-api" && record.provider !== "faster-whisper") {
      throw new Error("transcription.provider must use the current string setting");
    }
    validateTranscriptionStringField(record, "baseUrl");
    validateTranscriptionStringField(record, "apiKey");
    validateTranscriptionStringField(record, "model");
    validateTranscriptionStringField(record, "language");
    validateTranscriptionStringField(record, "prompt");
    validateTranscriptionBooleanField(record, "enableWordTimestamps");
    if (!record.extraParams || typeof record.extraParams !== "object" || Array.isArray(record.extraParams)) {
      throw new Error("transcription.extraParams must use the current object setting");
    }
    for (const [key, value] of Object.entries(record.extraParams as Record<string, unknown>)) {
      if (!key.trim() || key !== key.trim()) {
        throw new Error("transcription.extraParams keys must use the current non-empty string setting");
      }
      if (typeof value !== "string") {
        throw new Error("transcription.extraParams values must use the current string setting");
      }
    }
    validateTranscriptionStringField(record, "ytDlpArgs");
    validateTranscriptionStringField(record, "fasterWhisperBinary");
    validateTranscriptionStringField(record, "fasterWhisperModel");
    validateTranscriptionStringField(record, "fasterWhisperModelDir");
    if (record.fasterWhisperDevice !== "cpu" && record.fasterWhisperDevice !== "cuda") {
      throw new Error("transcription.fasterWhisperDevice must use the current string setting");
    }
    validateTranscriptionBooleanField(record, "fasterWhisperVadFilter");
    if (typeof record.fasterWhisperVadThreshold !== "number" || !Number.isFinite(record.fasterWhisperVadThreshold)) {
      throw new Error("transcription.fasterWhisperVadThreshold must use the current finite number setting");
    }
    if (record.fasterWhisperVadThreshold < 0 || record.fasterWhisperVadThreshold > 1) {
      throw new Error("transcription.fasterWhisperVadThreshold must be between 0 and 1");
    }
    validateTranscriptionStringField(record, "fasterWhisperVadMethod");
    validateTranscriptionBooleanField(record, "fasterWhisperUseKim2");
  }

  if (!configIds.has(source.activeConfigId as string)) {
    throw new Error("transcription.activeConfigId must reference an existing config");
  }
}

function validateTranscriptionStringField(source: Record<string, unknown>, field: keyof TranscriptionConfig): void {
  if (typeof source[field] !== "string") {
    throw new Error(`transcription.${field} must use the current string setting`);
  }
}

function validateTranscriptionBooleanField(source: Record<string, unknown>, field: keyof TranscriptionConfig): void {
  if (typeof source[field] !== "boolean") {
    throw new Error(`transcription.${field} must use the current boolean setting`);
  }
}
