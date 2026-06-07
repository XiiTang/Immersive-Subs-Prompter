import { promises as fs } from "node:fs";
import path from "node:path";
import { derivePluginKey } from "./pluginIdentity.js";
import { validatePluginManifest } from "./pluginManifest.js";
import type { InstalledPluginRecord, LocalPluginStatus, PluginRegistryState } from "./pluginTypes.js";

function createEmptyRegistry(): PluginRegistryState {
  return { plugins: {} };
}

const PLUGIN_RECORD_KEYS = [
  "pluginKey",
  "manifest",
  "sourceUrl",
  "enabled",
  "status",
  "error",
  "installedAt",
  "updatedAt"
] as const;
const LOCAL_PLUGIN_STATUSES: LocalPluginStatus[] = [
  "disabled",
  "enabled",
  "updating",
  "broken"
];

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

  for (const [pluginKey, record] of Object.entries(state.plugins as Record<string, unknown>)) {
    validatePluginRecord(pluginKey, record);
  }

  return input as PluginRegistryState;
}

function validatePluginRecord(pluginKey: string, record: unknown): void {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`${pluginKey} plugin registry record must use the current object setting`);
  }
  const source = record as Record<string, unknown>;
  assertNoUnknownKeys(source, PLUGIN_RECORD_KEYS, `${pluginKey} plugin registry record`);
  if (source.pluginKey !== pluginKey || typeof source.pluginKey !== "string") {
    throw new Error(`${pluginKey} plugin registry record pluginKey must match the current plugin key`);
  }
  const manifest = validatePluginManifest(source.manifest);
  if (derivePluginKey(manifest) !== pluginKey) {
    throw new Error(`${pluginKey} plugin registry record identity must match the current plugin key`);
  }
  for (const key of ["sourceUrl", "installedAt", "updatedAt"] as const) {
    if (typeof source[key] !== "string" || !source[key]) {
      throw new Error(`${pluginKey} plugin registry record ${key} must use the current string setting`);
    }
  }
  if (typeof source.enabled !== "boolean") {
    throw new Error(`${pluginKey} plugin registry record enabled must use the current boolean setting`);
  }
  if (typeof source.status !== "string" || !LOCAL_PLUGIN_STATUSES.includes(source.status as LocalPluginStatus)) {
    throw new Error(`${pluginKey} plugin registry record status must use the current status setting`);
  }
  if (source.error !== null && typeof source.error !== "string") {
    throw new Error(`${pluginKey} plugin registry record error must use the current string or null setting`);
  }
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
    state.plugins[record.pluginKey] = record;
    await this.write(state);
  }

  async updatePlugin(pluginKey: string, patch: Partial<InstalledPluginRecord>): Promise<InstalledPluginRecord> {
    const state = await this.read();
    const current = state.plugins[pluginKey];
    if (!current) {
      throw new Error(`Plugin "${pluginKey}" is not installed.`);
    }
    const next = { ...current, ...patch, pluginKey };
    validatePluginRecord(pluginKey, next);
    state.plugins[pluginKey] = next;
    await this.write(state);
    return next;
  }

  async deletePlugin(pluginKey: string): Promise<void> {
    const state = await this.read();
    delete state.plugins[pluginKey];
    await this.write(state);
  }

  async getPlugin(pluginKey: string): Promise<InstalledPluginRecord | null> {
    const state = await this.read();
    return state.plugins[pluginKey] ?? null;
  }

  async listPlugins(): Promise<InstalledPluginRecord[]> {
    const state = await this.read();
    return Object.values(state.plugins);
  }

  async write(state: PluginRegistryState): Promise<void> {
    validateRegistryState(state);
    await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
    await fs.writeFile(this.registryPath, JSON.stringify(state, null, 2), "utf-8");
  }
}
