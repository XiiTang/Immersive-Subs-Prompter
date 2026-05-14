import type {
  JellyfinembyPluginConfig,
  JellyfinembyServerConfig,
  MediaServerConfig,
  MediaServerSettings
} from "../../types.js";

export const DEFAULT_JELLYFINEMBY_PLUGIN_CONFIG: JellyfinembyPluginConfig = {
  servers: []
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeJellyfinembyServerConfig(
  input: Partial<JellyfinembyServerConfig> | Record<string, unknown> | null | undefined,
  index: number
): JellyfinembyServerConfig {
  const id = text(input?.id) || `jellyfinemby-server-${index}`;
  const name = text(input?.name) || `Server ${index + 1}`;
  let webSocketPath = text(input?.webSocketPath) || "/socket";
  if (!webSocketPath.startsWith("/")) {
    webSocketPath = `/${webSocketPath}`;
  }

  return {
    id,
    name,
    serverUrl: text(input?.serverUrl),
    apiKey: text(input?.apiKey),
    webSocketPath,
    enabled: typeof input?.enabled === "boolean" ? input.enabled : false
  };
}

export function sanitizeJellyfinembyPluginConfig(
  input: Partial<JellyfinembyPluginConfig> | Record<string, unknown> | null | undefined
): JellyfinembyPluginConfig {
  return {
    servers: Array.isArray(input?.servers)
      ? input.servers.map((server, index) =>
          sanitizeJellyfinembyServerConfig(server as Partial<JellyfinembyServerConfig>, index)
        )
      : []
  };
}

export function toMediaServerConfig(server: JellyfinembyServerConfig): MediaServerConfig {
  return {
    ...server,
    type: "jellyfinemby"
  };
}

export function toMediaServerSettings(config: JellyfinembyPluginConfig, enabled: boolean): MediaServerSettings {
  return {
    enabled,
    configs: config.servers.map(toMediaServerConfig)
  };
}
