export const SETTINGS_SECTIONS = [
  { id: "general", label: "General" },
  { id: "profiles", label: "Profiles" },
  { id: "rules", label: "Rules" },
  { id: "transcription", label: "Transcription" },
  { id: "media-server", label: "Media Server" },
  { id: "cache", label: "Cache" }
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]["id"];
