import type { FeatureSettings } from "../main/types.js";
import { createDefaultTranscriptionConfig, DEFAULT_TRANSCRIPTION_CONFIG_ID } from "./transcriptionDefaults.js";

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
    activeConfigId: DEFAULT_TRANSCRIPTION_CONFIG_ID,
    configs: [createDefaultTranscriptionConfig()]
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
      activeConfigId: settings.transcription.activeConfigId,
      configs: settings.transcription.configs.map((config) => ({
        ...config,
        extraParams: { ...config.extraParams }
      }))
    },
    jellyfinEmby: {
      enabled: settings.jellyfinEmby.enabled,
      config: {
        servers: settings.jellyfinEmby.config.servers.map((server) => ({ ...server }))
      }
    }
  };
}
