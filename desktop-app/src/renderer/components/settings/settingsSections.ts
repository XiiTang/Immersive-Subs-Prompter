export const SETTINGS_SECTIONS = [
  {
    id: "general",
    label: "General",
    anchorId: "settings-section-general"
  },
  {
    id: "profiles",
    label: "Profiles",
    anchorId: "settings-section-profiles"
  },
  {
    id: "rules",
    label: "Rules",
    anchorId: "settings-section-rules"
  },
  {
    id: "transcription",
    label: "Transcription",
    anchorId: "settings-section-transcription"
  },
  {
    id: "media-server",
    label: "Media Server",
    anchorId: "settings-section-media-server"
  },
  {
    id: "cache",
    label: "Cache",
    anchorId: "settings-section-cache"
  }
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];
