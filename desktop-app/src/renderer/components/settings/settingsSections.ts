export const SETTINGS_SECTIONS = [
  {
    id: "general",
    label: "General",
    description: "App language, shortcuts, startup, and connectivity",
    anchorId: "settings-section-general"
  },
  {
    id: "profiles",
    label: "Profiles",
    description: "Subtitle styles and playback preferences",
    anchorId: "settings-section-profiles"
  },
  {
    id: "rules",
    label: "Rules",
    description: "Automatic profile selection rules",
    anchorId: "settings-section-rules"
  },
  {
    id: "transcription",
    label: "Transcription",
    description: "Providers, prompts, and extraction defaults",
    anchorId: "settings-section-transcription"
  },
  {
    id: "media-server",
    label: "Media Server",
    description: "Server connections and playback integration",
    anchorId: "settings-section-media-server"
  },
  {
    id: "cache",
    label: "Cache",
    description: "Storage limits and cleanup controls",
    anchorId: "settings-section-cache"
  }
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];
