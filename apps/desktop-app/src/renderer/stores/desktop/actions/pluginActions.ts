import type { PluginSettingsRecord } from "../../../../main/types";
import type { PluginManifest } from "../../../../main/plugins/pluginManifest";
import type { DesktopStoreThis } from "../types";

export async function refreshPluginCatalog(this: DesktopStoreThis) {
  this.pluginCatalog = await window.usp.getPluginCatalog();
}

export async function previewPluginInstall(this: DesktopStoreThis, sourceUrl: string): Promise<PluginManifest> {
  return window.usp.previewPluginInstall(sourceUrl);
}

export async function installPlugin(this: DesktopStoreThis, sourceUrl: string, confirmedManifest: PluginManifest) {
  this.pluginCatalog = await window.usp.installPlugin(sourceUrl, confirmedManifest);
}

export async function updatePlugin(this: DesktopStoreThis, pluginKey: string) {
  this.pluginCatalog = await window.usp.updatePlugin(pluginKey);
}

export async function deletePlugin(this: DesktopStoreThis, pluginKey: string) {
  this.pluginCatalog = await window.usp.deletePlugin(pluginKey);
}

export async function enablePlugin(this: DesktopStoreThis, pluginKey: string) {
  this.pluginCatalog = await window.usp.enablePlugin(pluginKey);
}

export async function disablePlugin(this: DesktopStoreThis, pluginKey: string) {
  this.pluginCatalog = await window.usp.disablePlugin(pluginKey);
}

export function setPluginConfig(
  this: DesktopStoreThis,
  pluginKey: string,
  config: PluginSettingsRecord["config"]
) {
  if (!this.settings) {
    return;
  }
  this.updateSettings({
    plugins: {
      [pluginKey]: { config }
    }
  });
}

export function isPluginEnabled(this: DesktopStoreThis, pluginKey: string) {
  return this.pluginCatalog.some((plugin) => plugin.pluginKey === pluginKey && plugin.enabled);
}

export const pluginActions = {
  refreshPluginCatalog,
  previewPluginInstall,
  installPlugin,
  updatePlugin,
  deletePlugin,
  enablePlugin,
  disablePlugin,
  setPluginConfig,
  isPluginEnabled
};
