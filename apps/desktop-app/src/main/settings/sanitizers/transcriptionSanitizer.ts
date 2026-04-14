import { randomUUID } from "crypto";
import { TranscriptionConfig, TranscriptionPluginConfig } from "../../types.js";
import {
  DEFAULT_TRANSCRIPTION_CONFIG,
  DEFAULT_TRANSCRIPTION_CONFIG_ID,
  DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG,
  DEFAULT_TRANSCRIPTION_YTDLP_ARGS
} from "../constants.js";

export function sanitizeExtraParams(input: unknown): Record<string, string> {
  if (!input) {
    return {};
  }

  let source: Record<string, unknown> | null = null;
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === "object") {
        source = parsed as Record<string, unknown>;
      }
    } catch {
      source = null;
    }
  } else if (typeof input === "object") {
    source = input as Record<string, unknown>;
  }

  if (!source) {
    return {};
  }

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
  const name = typeof source.name === "string" && source.name.trim() ? source.name.trim() : defaultName;
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
