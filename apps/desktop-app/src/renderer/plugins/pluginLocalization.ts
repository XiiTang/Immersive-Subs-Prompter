import type { PluginCatalogRow } from "../../main/plugins/pluginTypes";

type Translator = (key: string, params?: Record<string, any>) => string;

const OFFICIAL_PLUGIN_KEYS: Record<string, { name: string; description: string }> = {
  "official.transcription": {
    name: "plugin-official-transcription-name",
    description: "plugin-official-transcription-description"
  },
  "official.word-lookup": {
    name: "plugin-official-word-lookup-name",
    description: "plugin-official-word-lookup-description"
  },
  "official.jellyfinemby": {
    name: "plugin-official-jellyfinemby-name",
    description: "plugin-official-jellyfinemby-description"
  }
};

const OFFICIAL_PLUGIN_SETTINGS_KEYS: Record<string, string> = {
  "official.transcription.settings": "plugin-official-transcription-name",
  "official.word-lookup.settings": "plugin-official-word-lookup-name",
  "official.jellyfinemby.settings": "plugin-official-jellyfinemby-name"
};

export function localizePluginName(plugin: Pick<PluginCatalogRow, "id" | "displayName">, t: Translator): string {
  const key = OFFICIAL_PLUGIN_KEYS[plugin.id]?.name;
  return key ? t(key) : plugin.displayName;
}

export function localizePluginDescription(plugin: Pick<PluginCatalogRow, "id" | "description">, t: Translator): string {
  const key = OFFICIAL_PLUGIN_KEYS[plugin.id]?.description;
  return key ? t(key) : plugin.description;
}

export function localizePluginSettingsTitle(sectionId: string, fallback: string, t: Translator): string {
  const key = OFFICIAL_PLUGIN_SETTINGS_KEYS[sectionId];
  return key ? t(key) : fallback;
}
