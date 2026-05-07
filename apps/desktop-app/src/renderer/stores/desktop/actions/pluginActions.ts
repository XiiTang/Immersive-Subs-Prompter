import type { PluginSettingsRecord } from "../../../../main/types";
import { TRANSCRIPTION_PLUGIN_ID, WORD_LOOKUP_PLUGIN_ID } from "../../../../common/pluginIds.js";
import { DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG } from "../defaults";
import type { DesktopStoreThis } from "../types";
import type { WordLookupPluginConfig } from "../../../plugins/wordLookupTypes";

const DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG: WordLookupPluginConfig = {
  wordListPath: "",
  modifierKey: "alt",
  panelSize: {
    width: 360,
    height: 300
  }
};

export async function refreshPluginCatalog(this: DesktopStoreThis) {
  this.pluginCatalog = await window.usp.getPluginCatalog();
}

export async function enablePlugin(this: DesktopStoreThis, pluginId: string) {
  this.pluginCatalog = await window.usp.enablePlugin(pluginId);
}

export async function disablePlugin(this: DesktopStoreThis, pluginId: string) {
  this.pluginCatalog = await window.usp.disablePlugin(pluginId);
}

export function setPluginConfig(
  this: DesktopStoreThis,
  pluginId: string,
  config: PluginSettingsRecord["config"]
) {
  if (!this.settings) {
    return;
  }
  this.updateSettings({
    plugins: {
      [pluginId]: { config }
    }
  });
}

export function isPluginEnabled(this: DesktopStoreThis, pluginId: string) {
  return this.pluginCatalog.some((plugin) => plugin.id === pluginId && plugin.enabled);
}

export function getTranscriptionPluginConfig(this: DesktopStoreThis) {
  const rawConfig = this.settings?.plugins[TRANSCRIPTION_PLUGIN_ID]?.config;
  if (!rawConfig || typeof rawConfig !== "object") {
    return DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG;
  }

  const candidate = rawConfig as Partial<typeof DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG>;
  const configs = Array.isArray(candidate.configs) && candidate.configs.length
    ? candidate.configs
    : DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG.configs;
  const activeConfigId =
    typeof candidate.activeConfigId === "string" && configs.some((config) => config.id === candidate.activeConfigId)
      ? candidate.activeConfigId
      : configs[0]?.id ?? DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG.activeConfigId;

  return {
    activeConfigId,
    configs
  };
}

export function getWordLookupPluginConfig(this: DesktopStoreThis): WordLookupPluginConfig {
  const rawConfig = this.settings?.plugins[WORD_LOOKUP_PLUGIN_ID]?.config;
  if (!rawConfig || typeof rawConfig !== "object") {
    return DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG;
  }

  const candidate = rawConfig as Partial<WordLookupPluginConfig>;
  const modifierKey =
    candidate.modifierKey === "ctrl" || candidate.modifierKey === "shift" || candidate.modifierKey === "alt"
      ? candidate.modifierKey
      : DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG.modifierKey;
  const panelSize = candidate.panelSize && typeof candidate.panelSize === "object"
    ? candidate.panelSize
    : DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG.panelSize;

  return {
    wordListPath: typeof candidate.wordListPath === "string" ? candidate.wordListPath : "",
    modifierKey,
    panelSize: {
      width: typeof panelSize.width === "number" ? panelSize.width : DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG.panelSize.width,
      height: typeof panelSize.height === "number" ? panelSize.height : DEFAULT_WORD_LOOKUP_PLUGIN_CONFIG.panelSize.height
    }
  };
}

export const pluginActions = {
  refreshPluginCatalog,
  enablePlugin,
  disablePlugin,
  setPluginConfig,
  isPluginEnabled,
  getTranscriptionPluginConfig,
  getWordLookupPluginConfig
};
