import type { FeatureSettings } from "../main/types.js";

export const FEATURE_IDS = ["wordLookup", "transcription", "jellyfinEmby"] as const;
export type FeatureId = (typeof FEATURE_IDS)[number];

export const DEFAULT_FEATURE_SETTINGS: FeatureSettings = {
  wordLookup: {
    enabled: false,
    config: {
      wordListPath: "",
      modifierKey: "alt",
      panelWidth: 360,
      panelHeight: 300
    }
  },
  transcription: {
    enabled: false,
    config: {
      provider: "whisper-api",
      baseUrl: "",
      apiKey: "",
      model: "whisper-1",
      language: "",
      prompt: "",
      enableWordTimestamps: false,
      extraParamsJson: "{}",
      fasterWhisperModel: "base",
      fasterWhisperModelDir: "",
      fasterWhisperDevice: "cpu",
      fasterWhisperVadFilter: true,
      fasterWhisperVadThreshold: 0.5,
      fasterWhisperVadMethod: "",
      fasterWhisperUseKim2: false
    }
  },
  jellyfinEmby: {
    enabled: false,
    config: {
      servers: []
    }
  }
};

export function cloneFeatureSettings(settings: FeatureSettings = DEFAULT_FEATURE_SETTINGS): FeatureSettings {
  return {
    wordLookup: {
      enabled: settings.wordLookup.enabled,
      config: { ...settings.wordLookup.config }
    },
    transcription: {
      enabled: settings.transcription.enabled,
      config: { ...settings.transcription.config }
    },
    jellyfinEmby: {
      enabled: settings.jellyfinEmby.enabled,
      config: {
        servers: settings.jellyfinEmby.config.servers.map((server) => ({ ...server }))
      }
    }
  };
}
