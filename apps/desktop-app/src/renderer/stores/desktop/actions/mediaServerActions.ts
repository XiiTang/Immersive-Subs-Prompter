import type { JellyfinembyPluginConfig, JellyfinembyServerConfig } from "../../../../main/types";
import { JELLYFINEMBY_PLUGIN_ID } from "../../../../common/pluginIds.js";
import { createId, mergePartial } from "../helpers";
import type { DesktopStoreThis } from "../types";

function writeJellyfinembyConfig(store: DesktopStoreThis, config: JellyfinembyPluginConfig) {
  store.setPluginConfig(JELLYFINEMBY_PLUGIN_ID, config as unknown as Record<string, unknown>);
}

export function addMediaServerConfig(this: DesktopStoreThis): string | null {
  if (!this.settings) {
    return null;
  }
  const config = this.getJellyfinembyPluginConfig();
  const newConfig: JellyfinembyServerConfig = {
    id: createId("mediaserver"),
    name: `Server ${config.servers.length + 1}`,
    serverUrl: "",
    apiKey: "",
    webSocketPath: "/socket",
    enabled: true
  };
  writeJellyfinembyConfig(this, {
    servers: [...config.servers, newConfig]
  });
  return newConfig.id;
}

export function updateMediaServerConfig(
  this: DesktopStoreThis,
  configId: string,
  patch: Partial<JellyfinembyServerConfig>
) {
  if (!this.settings) {
    return;
  }
  const config = this.getJellyfinembyPluginConfig();
  writeJellyfinembyConfig(this, {
    servers: config.servers.map((server) =>
      server.id === configId ? mergePartial(server, patch) : server
    )
  });
}

export function deleteMediaServerConfig(this: DesktopStoreThis, configId: string) {
  if (!this.settings) {
    return;
  }
  const config = this.getJellyfinembyPluginConfig();
  writeJellyfinembyConfig(this, {
    servers: config.servers.filter((server) => server.id !== configId)
  });
}

export const mediaServerActions = {
  addMediaServerConfig,
  updateMediaServerConfig,
  deleteMediaServerConfig
};
