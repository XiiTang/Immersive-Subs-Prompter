import type { PluginManifest } from "@immersive-subs/plugin-sdk";

export const JELLYFINEMBY_MANIFEST: PluginManifest = {
  id: "official.jellyfinemby",
  version: "1.0.0",
  displayName: "Jellyfin / Emby",
  description: "Sync playback and subtitles from Jellyfin or Emby media servers.",
  settings: [
    {
      id: "official.jellyfinemby.settings",
      title: "Jellyfin / Emby",
      anchorId: "settings-section-plugin-official-jellyfinemby"
    }
  ]
};
