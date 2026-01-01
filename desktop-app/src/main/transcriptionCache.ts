import { createHash } from "crypto";
import { TranscriptionConfig } from "./types.js";

export function buildTranscriptionCacheKey(videoUrl: string, config: TranscriptionConfig): string {
  const provider = config.provider === "faster-whisper" ? "faster-whisper" : "whisper-api";
  const signaturePayload = {
    id: config.id,
    provider,
    model: provider === "faster-whisper" ? config.fasterWhisperModel : config.model,
    language: config.language,
    prompt: config.prompt,
    enableWordTimestamps: config.enableWordTimestamps,
    ytDlpArgs: config.ytDlpArgs,
    baseUrl: provider === "whisper-api" ? config.baseUrl : "",
    extraParams: provider === "whisper-api" ? config.extraParams : undefined,
    fasterWhisper:
      provider === "faster-whisper"
        ? {
            device: config.fasterWhisperDevice,
            modelDir: config.fasterWhisperModelDir,
            vadFilter: config.fasterWhisperVadFilter,
            vadThreshold: config.fasterWhisperVadThreshold,
            vadMethod: config.fasterWhisperVadMethod,
            useKim2: config.fasterWhisperUseKim2
          }
        : undefined
  };
  const signature = createHash("sha256").update(JSON.stringify(signaturePayload)).digest("hex").slice(0, 12);
  return `${videoUrl}#${signature}`;
}
