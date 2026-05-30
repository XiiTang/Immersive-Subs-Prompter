import type {
  JellyfinembyPluginConfig,
  PluginSettingsRecord,
  TranscriptionPluginConfig
} from "../../../../main/types";
import { JELLYFINEMBY_PLUGIN_ID, TRANSCRIPTION_PLUGIN_ID, WORD_LOOKUP_PLUGIN_ID } from "../../../../common/pluginIds.js";
import type { DesktopStoreThis } from "../types";
import type { WordLookupPluginConfig } from "../../../plugins/wordLookupTypes";

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

function getRequiredPluginConfig<T>(store: DesktopStoreThis, pluginId: string): T {
  const config = store.settings?.plugins[pluginId]?.config;
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error(`Missing sanitized plugin config: ${pluginId}`);
  }
  return config as unknown as T;
}

export function getTranscriptionPluginConfig(this: DesktopStoreThis): TranscriptionPluginConfig {
  return getRequiredPluginConfig<TranscriptionPluginConfig>(this, TRANSCRIPTION_PLUGIN_ID);
}

export function getWordLookupPluginConfig(this: DesktopStoreThis): WordLookupPluginConfig {
  return getRequiredPluginConfig<WordLookupPluginConfig>(this, WORD_LOOKUP_PLUGIN_ID);
}

export function getJellyfinembyPluginConfig(this: DesktopStoreThis): JellyfinembyPluginConfig {
  return getRequiredPluginConfig<JellyfinembyPluginConfig>(this, JELLYFINEMBY_PLUGIN_ID);
}

export const pluginActions = {
  refreshPluginCatalog,
  enablePlugin,
  disablePlugin,
  setPluginConfig,
  isPluginEnabled,
  getTranscriptionPluginConfig,
  getWordLookupPluginConfig,
  getJellyfinembyPluginConfig
};
