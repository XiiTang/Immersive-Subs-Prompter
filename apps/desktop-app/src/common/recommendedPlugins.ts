import type { RecommendedPluginInstallLink } from "../main/plugins/pluginTypes.js";

const RAW_PLUGIN_REPOSITORY_URL = "https://raw.githubusercontent.com/XiiTang/Immersive-Subs-Prompter/main/plugin-repository";
const XIITANG_AUTHOR = {
  id: "xiitang",
  name: "XiiTang",
  url: "https://github.com/XiiTang"
};

export const RECOMMENDED_PLUGIN_INSTALL_LINKS: RecommendedPluginInstallLink[] = [
  {
    pluginKey: "xiitang/word-lookup",
    id: "word-lookup",
    author: XIITANG_AUTHOR,
    displayName: "Word Lookup",
    description: "Look up subtitle words from a configured word list.",
    sourceUrl: `${RAW_PLUGIN_REPOSITORY_URL}/word-lookup/manifest.json`
  },
  {
    pluginKey: "xiitang/transcription",
    id: "transcription",
    author: XIITANG_AUTHOR,
    displayName: "Speech Transcription",
    description: "Transcribe active browser videos into subtitle tracks.",
    sourceUrl: `${RAW_PLUGIN_REPOSITORY_URL}/transcription/manifest.json`
  },
  {
    pluginKey: "xiitang/jellyfinemby",
    id: "jellyfinemby",
    author: XIITANG_AUTHOR,
    displayName: "Jellyfin / Emby",
    description: "Connect Jellyfin or Emby sessions as external media sources.",
    sourceUrl: `${RAW_PLUGIN_REPOSITORY_URL}/jellyfinemby/manifest.json`
  }
];
