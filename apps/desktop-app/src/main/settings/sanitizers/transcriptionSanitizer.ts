import { randomUUID } from "crypto";
import { TranscriptionConfig, TranscriptionPluginConfig } from "../../types.js";
import {
  DEFAULT_TRANSCRIPTION_CONFIG,
  DEFAULT_TRANSCRIPTION_CONFIG_ID,
  DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG,
  DEFAULT_TRANSCRIPTION_YTDLP_ARGS
} from "../constants.js";
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

export function sanitizeExtraParams(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  const source = input as Record<string, unknown>;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!key || typeof key !== "string") {
      continue;
    }
    if (value === undefined || value === null) {
      continue;
    }
    const normalizedKey = key.trim();
    if (!normalizedKey) {
      continue;
    }
    result[normalizedKey] = typeof value === "string" ? value : String(value);
  }
  return result;
}

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

export function sanitizeTranscriptionConfig(
  input: Partial<TranscriptionConfig> | null | undefined,
  fallbackId?: string
): TranscriptionConfig {
  const source = input ?? {};
  const id =
    typeof source.id === "string" && source.id.trim()
      ? source.id.trim()
      : fallbackId ?? randomId();
  const provider: TranscriptionConfig["provider"] =
    source.provider === "faster-whisper" ? "faster-whisper" : "whisper-api";
  const defaultName = provider === "faster-whisper" ? "Faster-Whisper" : "Whisper API";
  const rawName = typeof source.name === "string" ? source.name.trim() : "";
  const name = rawName || defaultName;
  const baseUrl =
    typeof source.baseUrl === "string" && source.baseUrl.trim().length
      ? source.baseUrl.trim()
      : DEFAULT_TRANSCRIPTION_CONFIG.baseUrl;
  const apiKey = typeof source.apiKey === "string" ? source.apiKey.trim() : "";
  const model =
    typeof source.model === "string" && source.model.trim().length
      ? source.model.trim()
      : DEFAULT_TRANSCRIPTION_CONFIG.model;
  const language = typeof source.language === "string" ? source.language.trim() : "";
  const prompt = typeof source.prompt === "string" ? source.prompt.trim() : "";
  const enableWordTimestamps =
    typeof source.enableWordTimestamps === "boolean"
      ? source.enableWordTimestamps
      : DEFAULT_TRANSCRIPTION_CONFIG.enableWordTimestamps;
  const ytDlpArgs =
    typeof source.ytDlpArgs === "string" && source.ytDlpArgs.trim().length
      ? source.ytDlpArgs.trim()
      : DEFAULT_TRANSCRIPTION_YTDLP_ARGS;
  const extraParams = sanitizeExtraParams(source.extraParams);
  const fasterWhisperBinary =
    typeof source.fasterWhisperBinary === "string" && source.fasterWhisperBinary.trim().length
      ? source.fasterWhisperBinary.trim()
      : DEFAULT_TRANSCRIPTION_CONFIG.fasterWhisperBinary;
  const fasterWhisperModel =
    typeof source.fasterWhisperModel === "string" && source.fasterWhisperModel.trim().length
      ? source.fasterWhisperModel.trim()
      : DEFAULT_TRANSCRIPTION_CONFIG.fasterWhisperModel;
  const fasterWhisperModelDir =
    typeof source.fasterWhisperModelDir === "string" && source.fasterWhisperModelDir.trim()
      ? source.fasterWhisperModelDir.trim()
      : DEFAULT_TRANSCRIPTION_CONFIG.fasterWhisperModelDir;
  const fasterWhisperDevice: TranscriptionConfig["fasterWhisperDevice"] =
    source.fasterWhisperDevice === "cuda" ? "cuda" : "cpu";
  const fasterWhisperVadFilter =
    typeof source.fasterWhisperVadFilter === "boolean"
      ? source.fasterWhisperVadFilter
      : DEFAULT_TRANSCRIPTION_CONFIG.fasterWhisperVadFilter;
  let fasterWhisperVadThreshold = Number(source.fasterWhisperVadThreshold);
  if (!Number.isFinite(fasterWhisperVadThreshold)) {
    fasterWhisperVadThreshold = DEFAULT_TRANSCRIPTION_CONFIG.fasterWhisperVadThreshold;
  }
  fasterWhisperVadThreshold = Math.min(1, Math.max(0, fasterWhisperVadThreshold));
  const fasterWhisperVadMethod =
    typeof source.fasterWhisperVadMethod === "string"
      ? source.fasterWhisperVadMethod.trim()
      : DEFAULT_TRANSCRIPTION_CONFIG.fasterWhisperVadMethod;
  const fasterWhisperUseKim2 =
    typeof source.fasterWhisperUseKim2 === "boolean"
      ? source.fasterWhisperUseKim2
      : DEFAULT_TRANSCRIPTION_CONFIG.fasterWhisperUseKim2;

  return {
    id,
    name,
    provider,
    baseUrl,
    apiKey,
    model,
    language,
    prompt,
    enableWordTimestamps,
    extraParams,
    ytDlpArgs,
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

export function sanitizeTranscriptionPluginConfig(
  input: Partial<TranscriptionPluginConfig> | null | undefined
): TranscriptionPluginConfig {
  const source = input ?? {};
  let configs: TranscriptionConfig[] = [];
  if (Array.isArray(source.configs)) {
    configs = source.configs.map((config, index) =>
      sanitizeTranscriptionConfig(config, `transcription-${index + 1}`)
    );
  }

  if (!configs.length) {
    configs = [sanitizeTranscriptionConfig(DEFAULT_TRANSCRIPTION_CONFIG, DEFAULT_TRANSCRIPTION_CONFIG.id)];
  }

  const requestedActiveId =
    typeof source.activeConfigId === "string" && source.activeConfigId.trim()
      ? source.activeConfigId.trim()
      : configs[0]?.id ?? DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG.activeConfigId;
  const activeConfigId = configs.some((config) => config.id === requestedActiveId)
    ? requestedActiveId
    : configs[0]?.id ?? DEFAULT_TRANSCRIPTION_CONFIG_ID;

  return {
    activeConfigId,
    configs
  };
}

function randomId(): string {
  return randomUUID();
}
