import { randomUUID } from "crypto";
import { MediaServerConfig, MediaServerSettings } from "../../types.js";
import { DEFAULT_MEDIA_SERVER_SETTINGS } from "../constants.js";

export function sanitizeMediaServerConfig(
  input: Partial<MediaServerConfig> | null | undefined,
  fallbackId?: string,
  fallbackEnabled?: boolean
): MediaServerConfig {
  const id = typeof input?.id === "string" && input.id.trim() ? input.id.trim() : (fallbackId || randomUUID());
  const name = typeof input?.name === "string" ? input.name.trim() : "Media Server";
  const serverUrl = typeof input?.serverUrl === "string" ? input.serverUrl.trim() : "";
  const apiKey = typeof input?.apiKey === "string" ? input.apiKey.trim() : "";
  let webSocketPath = typeof input?.webSocketPath === "string" ? input.webSocketPath.trim() : "/socket";
  const type: MediaServerConfig["type"] = "jellyfinemby";

  if (!webSocketPath.length) {
    webSocketPath = "/socket";
  }
  if (!webSocketPath.startsWith("/")) {
    webSocketPath = `/${webSocketPath}`;
  }
  const enabled =
    typeof input?.enabled === "boolean"
      ? input.enabled
      : typeof fallbackEnabled === "boolean"
        ? fallbackEnabled
        : false;

  return {
    id,
    name,
    type,
    serverUrl,
    apiKey,
    webSocketPath,
    enabled
  };
}

export function sanitizeMediaServerSettings(input: Partial<MediaServerSettings> | null | undefined): MediaServerSettings {
  const source = input ?? {};
  const enabled = typeof source.enabled === "boolean" ? source.enabled : DEFAULT_MEDIA_SERVER_SETTINGS.enabled;

  let configs: MediaServerConfig[] = [];
  const hasExplicitEnabledFlags =
    Array.isArray(source.configs) &&
    source.configs.some((config) => typeof (config as Partial<MediaServerConfig> | undefined)?.enabled === "boolean");

  const hasOldFormat = "serverUrl" in source || "apiKey" in source || "webSocketPath" in source;

  if (hasOldFormat) {
    const oldServerUrl = typeof (source as any).serverUrl === "string" ? (source as any).serverUrl.trim() : "";
    const oldApiKey = typeof (source as any).apiKey === "string" ? (source as any).apiKey.trim() : "";
    const oldWebSocketPath = typeof (source as any).webSocketPath === "string" ? (source as any).webSocketPath.trim() : "/socket";

    if (oldServerUrl || oldApiKey) {
      configs.push(sanitizeMediaServerConfig({
        id: "jellyfinemby-config-migrated",
        name: "Jellyfinemby Server",
        type: "jellyfinemby",
        serverUrl: oldServerUrl,
        apiKey: oldApiKey,
        webSocketPath: oldWebSocketPath,
        enabled: true
      }));
    }
  } else if (Array.isArray(source.configs)) {
    configs = source.configs.map((config, index) =>
      sanitizeMediaServerConfig(config, `jellyfinemby-config-${index}`)
    );
  }

  if (!hasExplicitEnabledFlags && configs.length > 0) {
    const legacyActiveConfigIdRaw = (source as { activeConfigId?: string }).activeConfigId;
    const legacyActiveConfigId =
      typeof legacyActiveConfigIdRaw === "string" && legacyActiveConfigIdRaw.trim() ? legacyActiveConfigIdRaw.trim() : null;
    const enabledConfigId = legacyActiveConfigId ?? configs[0].id;
    configs = configs.map((config) => ({
      ...config,
      enabled: config.id === enabledConfigId
    }));
  }

  return {
    enabled,
    configs
  };
}
