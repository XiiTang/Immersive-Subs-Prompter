import { promises as fs } from "fs";
import path from "path";
import type { InstalledPluginRecord, PluginRegistryState } from "./pluginTypes.js";

function createEmptyRegistry(): PluginRegistryState {
  return { plugins: {} };
}

const PLUGIN_RECORD_KEYS = ["id", "enabled", "error"] as const;

function assertNoUnknownKeys(source: Record<string, unknown>, allowedKeys: readonly string[], context: string): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      throw new Error(`${context} contains unknown setting: ${key}`);
    }
  }
}

function validateRegistryState(input: unknown): PluginRegistryState {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("plugin registry must use the current object setting");
  }
  const state = input as Record<string, unknown>;
  assertNoUnknownKeys(state, ["plugins"], "plugin registry");
  if (!state.plugins || typeof state.plugins !== "object" || Array.isArray(state.plugins)) {
    throw new Error("plugin registry must use the current object setting");
  }

  for (const [pluginId, record] of Object.entries(state.plugins as Record<string, unknown>)) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`${pluginId} plugin registry record must use the current object setting`);
    }
    const source = record as Record<string, unknown>;
    assertNoUnknownKeys(source, PLUGIN_RECORD_KEYS, `${pluginId} plugin registry record`);
    if (source.id !== pluginId || typeof source.id !== "string") {
      throw new Error(`${pluginId} plugin registry record id must match the current plugin id`);
    }
    if (typeof source.enabled !== "boolean") {
      throw new Error(`${pluginId} plugin registry record enabled must use the current boolean setting`);
    }
    if (source.error !== null && typeof source.error !== "string") {
      throw new Error(`${pluginId} plugin registry record error must use the current string or null setting`);
    }
  }

  return input as PluginRegistryState;
}

export class PluginRegistryStore {
  private readonly registryPath: string;

  constructor(registryPath: string) {
    this.registryPath = registryPath;
  }

  async read(): Promise<PluginRegistryState> {
    try {
      const raw = await fs.readFile(this.registryPath, "utf-8");
      const parsed = JSON.parse(raw);
      return validateRegistryState(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return createEmptyRegistry();
      }
      throw error;
    }
  }

  async writePlugin(record: InstalledPluginRecord): Promise<void> {
    const state = await this.read();
    state.plugins[record.id] = record;
    await this.write(state);
  }

  async listPlugins(): Promise<InstalledPluginRecord[]> {
    const state = await this.read();
    return Object.values(state.plugins);
  }

  async write(state: PluginRegistryState): Promise<void> {
    await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
    await fs.writeFile(this.registryPath, JSON.stringify(state, null, 2), "utf-8");
  }

}
