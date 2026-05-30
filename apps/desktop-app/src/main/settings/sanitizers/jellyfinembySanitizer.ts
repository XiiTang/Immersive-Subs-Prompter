import type {
  JellyfinembyServerConfig
} from "../../types.js";
import { assertNoUnknownKeys } from "../utils.js";

const JELLYFINEMBY_CONFIG_KEYS = ["servers"] as const;
const JELLYFINEMBY_SERVER_KEYS = ["id", "name", "serverUrl", "apiKey", "webSocketPath", "enabled"] as const;

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
