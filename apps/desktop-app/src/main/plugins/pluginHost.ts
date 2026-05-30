import type { PluginManifest, PluginMainContribution } from "./pluginManifest.js";
import type { PluginRegistryStore } from "./pluginRegistryStore.js";
import type { PluginCatalogRow } from "./pluginTypes.js";
import { createLogger } from "../logger.js";

export type PluginMainFactory = () => PluginMainContribution;

interface BundledPlugin {
  manifest: PluginManifest;
  factory: PluginMainFactory;
}

export class PluginHost {
  private readonly log = createLogger("plugin-host");
  private readonly loaded = new Map<string, PluginMainContribution>();
  private readonly bundled = new Map<string, BundledPlugin>();

  constructor(private readonly registryStore: PluginRegistryStore) {}

  registerBundledPlugin(manifest: PluginManifest, factory: PluginMainFactory): void {
    this.bundled.set(manifest.id, { manifest, factory });
  }

  async loadEnabledPlugins(): Promise<void> {
    for (const record of await this.registryStore.listPlugins()) {
      const bundled = this.bundled.get(record.id);
      if (!bundled) {
        throw new Error(`Plugin "${record.id}" has no bundled code.`);
      }
      if (!record.enabled) continue;

      try {
        const contribution = bundled.factory();
        this.loaded.set(record.id, contribution);
        this.log.info(`Loaded plugin "${record.id}"`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.log.error(`Failed to load plugin "${record.id}": ${message}`);
        await this.registryStore.writePlugin({
          id: record.id,
          enabled: false,
          error: message
        });
      }
    }
  }

  getCommand(pluginId: string, commandName: string): ((...args: unknown[]) => Promise<unknown>) | null {
    const contribution = this.loaded.get(pluginId);
    return contribution?.commands?.[commandName] ?? null;
  }

  async listCatalog(): Promise<PluginCatalogRow[]> {
    const registry = await this.registryStore.read();
    return Array.from(this.bundled.values()).map(({ manifest }) => {
      const record = registry.plugins[manifest.id];
      const status = record?.error ? "broken" : record?.enabled ? "enabled" : "disabled";
      return {
        id: manifest.id,
        version: manifest.version,
        displayName: manifest.displayName,
        description: manifest.description,
        status,
        enabled: record?.enabled ?? false,
        error: record?.error ?? null,
        settings: manifest.settings
      };
    });
  }

  async enable(pluginId: string): Promise<void> {
    const bundled = this.bundled.get(pluginId);
    if (!bundled) {
      throw new Error(`Plugin "${pluginId}" has no bundled code.`);
    }

    try {
      const contribution = bundled.factory();
      this.loaded.set(pluginId, contribution);
      await this.registryStore.writePlugin({
        id: pluginId as PluginManifest["id"],
        enabled: true,
        error: null
      });
      this.log.info(`Enabled plugin "${pluginId}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.registryStore.writePlugin({
        id: pluginId as PluginManifest["id"],
        enabled: false,
        error: message
      });
      throw error;
    }
  }

  async disable(pluginId: string): Promise<void> {
    const contribution = this.loaded.get(pluginId);
    if (contribution?.dispose) {
      contribution.dispose();
    }
    this.loaded.delete(pluginId);

    await this.registryStore.writePlugin({
      id: pluginId as PluginManifest["id"],
      enabled: false,
      error: null
    });
    this.log.info(`Disabled plugin "${pluginId}"`);
  }
}
