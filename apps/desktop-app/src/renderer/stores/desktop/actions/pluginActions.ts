import type { PluginSettingsRecord } from "../../../../main/types";
import { TRANSCRIPTION_PLUGIN_ID } from "../../../../common/pluginIds.js";
import { DEFAULT_TRANSCRIPTION_PLUGIN_CONFIG } from "../defaults";
import type { DesktopStoreThis } from "../types";

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

export const pluginActions = {
  refreshPluginCatalog,
  enablePlugin,
  disablePlugin,
  setPluginConfig,
  isPluginEnabled,
  getTranscriptionPluginConfig
};
