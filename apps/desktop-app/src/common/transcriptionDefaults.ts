import type { TranscriptionConfig } from "../main/types.js";

export const DEFAULT_TRANSCRIPTION_YTDLP_ARGS =
  '--extract-audio --audio-format wav --audio-quality 32K --postprocessor-args "-ac 1 -ar 16000" --cookies-from-browser firefox';

export const BASE_TRANSCRIPTION_CONFIG: Omit<TranscriptionConfig, "id"> = {
  name: "Default Whisper API",
  provider: "whisper-api",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "whisper-1",
  language: "",
  prompt: "",
  enableWordTimestamps: false,
  extraParams: {},
  ytDlpArgs: DEFAULT_TRANSCRIPTION_YTDLP_ARGS,
  fasterWhisperBinary: "faster-whisper",
  fasterWhisperModel: "base",
  fasterWhisperModelDir: "",
  fasterWhisperDevice: "cpu",
  fasterWhisperVadFilter: true,
  fasterWhisperVadThreshold: 0.5,
  fasterWhisperVadMethod: "",
  fasterWhisperUseKim2: false
};
