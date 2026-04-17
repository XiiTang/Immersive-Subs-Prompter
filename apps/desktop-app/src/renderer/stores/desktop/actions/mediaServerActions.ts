import type { MediaServerConfig } from "../../../../main/types";
import { createId, mergePartial } from "../helpers";
import type { DesktopStoreThis } from "../types";

export function addMediaServerConfig(this: DesktopStoreThis): string | null {
  if (!this.settings) {
    return null;
  }
  const newConfig: MediaServerConfig = {
    id: createId("mediaserver"),
    name: `Server ${this.settings.mediaServer.configs.length + 1}`,
    type: "jellyfinemby",
    serverUrl: "",
    apiKey: "",
    webSocketPath: "",
    enabled: true
  };
  const nextConfigs = [...this.settings.mediaServer.configs, newConfig];
  this.updateSettings({
    mediaServer: {
      ...this.settings.mediaServer,
      configs: nextConfigs
    }
  });
  return newConfig.id;
}

export function updateMediaServerConfig(
  this: DesktopStoreThis,
  configId: string,
  patch: Partial<MediaServerConfig>
) {
  if (!this.settings) {
    return;
  }
  const nextConfigs = this.settings.mediaServer.configs.map((config) =>
    config.id === configId ? mergePartial(config, patch) : config
  );
  this.updateSettings({
    mediaServer: {
      ...this.settings.mediaServer,
      configs: nextConfigs
    }
  });
}

export function deleteMediaServerConfig(this: DesktopStoreThis, configId: string) {
  if (!this.settings) {
    return;
  }
  const configs = this.settings.mediaServer.configs;
  if (configs.length <= 1 && this.settings.mediaServer.enabled) {
    console.warn("[Renderer] Cannot delete the last media server configuration while MediaServer is enabled.");
    return;
  }
  const nextConfigs = configs.filter((config) => config.id !== configId);
  this.updateSettings({
    mediaServer: {
      ...this.settings.mediaServer,
      configs: nextConfigs
    }
  });
}

export function setMediaServerEnabled(this: DesktopStoreThis, enabled: boolean) {
  if (!this.settings) {
    return;
  }
  this.updateSettings({
    mediaServer: {
      ...this.settings.mediaServer,
      enabled
    }
  });
}

export const mediaServerActions = {
  addMediaServerConfig,
  updateMediaServerConfig,
  deleteMediaServerConfig,
  setMediaServerEnabled
};
