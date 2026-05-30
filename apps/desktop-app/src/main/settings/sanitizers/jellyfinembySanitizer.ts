import type {
  JellyfinembyPluginConfig,
  JellyfinembyServerConfig,
  MediaServerConfig,
  MediaServerSettings
} from "../../types.js";
import { assertNoUnknownKeys } from "../utils.js";

const JELLYFINEMBY_CONFIG_KEYS = ["servers"] as const;
const JELLYFINEMBY_SERVER_KEYS = ["id", "name", "serverUrl", "apiKey", "webSocketPath", "enabled"] as const;

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

function validateStringField(source: Record<string, unknown>, field: keyof JellyfinembyServerConfig): void {
  if (typeof source[field] !== "string") {
    throw new Error(`jellyfinemby.server.${field} must use the current string setting`);
  }
}

export function validateJellyfinembyPluginConfigForUpdate(input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("jellyfinemby config must use the current object setting");
  }

  const source = input as Record<string, unknown>;
  assertNoUnknownKeys(source, JELLYFINEMBY_CONFIG_KEYS, "jellyfinemby");
  if (!Array.isArray(source.servers)) {
    throw new Error("jellyfinemby.servers must use the current array setting");
  }

  for (const server of source.servers) {
    if (!server || typeof server !== "object" || Array.isArray(server)) {
      throw new Error("jellyfinemby.server must use the current object setting");
    }
    const record = server as Record<string, unknown>;
    assertNoUnknownKeys(record, JELLYFINEMBY_SERVER_KEYS, "jellyfinemby.server");
    validateStringField(record, "id");
    validateStringField(record, "name");
    validateStringField(record, "serverUrl");
    validateStringField(record, "apiKey");
    validateStringField(record, "webSocketPath");
    if (!(record.webSocketPath as string).startsWith("/")) {
      throw new Error("jellyfinemby.server.webSocketPath must start with /");
    }
    if (typeof record.enabled !== "boolean") {
      throw new Error("jellyfinemby.server.enabled must use the current boolean setting");
    }
  }
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
