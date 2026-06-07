import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppSettings, SubtitleTrack } from "../types.js";
import { createLogger } from "../logger.js";
import type {
  MediaSourceAdapter,
  TranscriptionProvider,
  WordLookupProvider
} from "./pluginContributionRegistry.js";
import { PluginContributionRegistry } from "./pluginContributionRegistry.js";
import type { PluginManifest, PluginSettingsContribution, PluginSettingsFieldSchema } from "./pluginManifest.js";
import { validatePluginManifest } from "./pluginManifest.js";
import { derivePluginKey } from "./pluginIdentity.js";
import { PluginPackageInstaller, type PluginInstallResult } from "./pluginPackageInstaller.js";
import { getPluginInstallPath, getPluginVersionsPath } from "./pluginPaths.js";
import { PluginRegistryStore } from "./pluginRegistryStore.js";
import { PluginRuntimeHost, type PluginRuntimeConfigUpdate } from "./pluginRuntimeHost.js";
import type { InstalledPluginRecord, PluginCatalogRow } from "./pluginTypes.js";

export interface PluginRuntime {
  getWordLookupProvider(): WordLookupProvider | null;
  getTranscriptionProvider(): TranscriptionProvider | null;
  getMediaSourceAdapter(): MediaSourceAdapter | null;
  updateConfig(update: PluginRuntimeConfigUpdate): Promise<void>;
  stop(): Promise<void>;
}

interface PluginRuntimeStartInput {
  pluginKey: string;
  entryPath: string;
  permissions: PluginManifest["permissions"];
  config: Record<string, unknown>;
  allowedNetworkHosts: string[];
  readableFiles: string[];
  onRuntimeExit: (error: Error) => void;
  onContributionsChanged: () => void;
  transcriptionRuntime?: {
    transcribe(videoUrl: string, config: Record<string, unknown>): Promise<SubtitleTrack>;
  };
}

export interface PluginInstaller {
  install(sourceUrl: string, confirmedManifest: PluginManifest): Promise<PluginInstallResult>;
  preview(sourceUrl: string): Promise<PluginManifest>;
}

export interface PluginManagerOptions {
  rootDir: string;
  registryStore: PluginRegistryStore;
  appVersion?: string;
  contributionRegistry?: PluginContributionRegistry;
  installer?: PluginInstaller;
  getSettings: () => AppSettings;
  replaceSettings: (settings: AppSettings) => void;
  createRuntime?: (input: PluginRuntimeStartInput) => Promise<PluginRuntime>;
  transcriptionRuntime?: {
    transcribe(videoUrl: string, config: Record<string, unknown>): Promise<SubtitleTrack>;
  };
  onCatalogChanged?: () => Promise<void> | void;
  onPluginContributionsRemoved?: (pluginKey: string) => Promise<void> | void;
}

export class PluginManager {
  private readonly log = createLogger("plugin-manager");
  private readonly installer: PluginInstaller;
  private readonly runtimes = new Map<string, PluginRuntime>();
  readonly contributions: PluginContributionRegistry;

  constructor(private readonly options: PluginManagerOptions) {
    this.installer = options.installer ?? new PluginPackageInstaller({ rootDir: options.rootDir, appVersion: options.appVersion });
    this.contributions = options.contributionRegistry ?? new PluginContributionRegistry();
  }

  async install(sourceUrl: string, confirmedManifest: PluginManifest): Promise<PluginCatalogRow[]> {
    if (!confirmedManifest) {
      throw new Error("Plugin install requires a confirmed manifest");
    }
    const candidate = validatePluginManifest(confirmedManifest, { appVersion: this.options.appVersion });
    const candidateKey = derivePluginKey(candidate);
    const previous = await this.options.registryStore.getPlugin(candidateKey);
    if (previous?.manifest.version === candidate.version) {
      throw new Error(`${candidateKey} ${candidate.version} is already installed.`);
    }

    const installed = await this.installer.install(sourceUrl, candidate);
    const installedKey = derivePluginKey(installed.manifest);
    assertPluginIdentity(candidateKey, installedKey, "install result");
    if (candidate.version !== installed.manifest.version) {
      throw new Error(
        `Plugin install result for ${candidateKey} returned version ${installed.manifest.version}; expected ${candidate.version}.`
      );
    }
    const now = new Date().toISOString();
    const previousRecord = previous;
    const wasEnabled = previousRecord?.enabled ?? false;
    if (wasEnabled) {
      await this.stopRuntime(installedKey);
    }
    await this.options.registryStore.writePlugin({
      pluginKey: installedKey,
      manifest: installed.manifest,
      sourceUrl,
      enabled: wasEnabled,
      status: wasEnabled ? "enabled" : "disabled",
      error: null,
      installedAt: previousRecord?.installedAt ?? now,
      updatedAt: now
    });
    this.ensurePluginConfig(installed.manifest);
    if (wasEnabled) {
      try {
        await this.enable(installedKey);
      } catch (error) {
        await this.stopRuntime(installedKey);
        if (previousRecord) {
          await this.options.registryStore.writePlugin(previousRecord);
          await this.enable(previousRecord.pluginKey).catch((restoreError) => {
            this.log.error(`Failed to restart previous plugin "${previousRecord.pluginKey}" after install failure`, restoreError);
          });
        }
        throw error;
      }
    }
    return this.listCatalog();
  }

  async previewInstall(sourceUrl: string): Promise<PluginManifest> {
    return this.installer.preview(sourceUrl);
  }

  async update(pluginKey: string): Promise<PluginCatalogRow[]> {
    const record = await this.requireRecord(pluginKey);
    const wasEnabled = record.enabled;
    const confirmedManifest = await this.installer.preview(record.sourceUrl);
    assertUpdateSourcePluginKey(pluginKey, derivePluginKey(confirmedManifest));
    if (confirmedManifest.version === record.manifest.version) {
      throw new Error(`${pluginKey} ${record.manifest.version} is already installed.`);
    }
    await this.options.registryStore.updatePlugin(pluginKey, {
      status: "updating",
      error: null
    });
    let installed: PluginInstallResult;
    try {
      installed = await this.installer.install(record.sourceUrl, confirmedManifest);
      assertUpdateSourcePluginKey(pluginKey, derivePluginKey(installed.manifest));
      if (installed.manifest.version !== confirmedManifest.version) {
        throw new Error(
          `Plugin update result for ${pluginKey} returned version ${installed.manifest.version}; expected ${confirmedManifest.version}.`
        );
      }
    } catch (error) {
      await this.options.registryStore.writePlugin(record);
      throw error;
    }

    if (wasEnabled) {
      await this.stopRuntime(pluginKey);
    }
    await this.options.registryStore.writePlugin({
      ...record,
      manifest: installed.manifest,
      enabled: wasEnabled,
      status: wasEnabled ? "enabled" : "disabled",
      error: null,
      updatedAt: new Date().toISOString()
    });
    this.ensurePluginConfig(installed.manifest);
    if (wasEnabled) {
      try {
        await this.enable(pluginKey);
      } catch (error) {
        await this.stopRuntime(pluginKey);
        await this.options.registryStore.writePlugin(record);
        await this.enable(pluginKey).catch((restoreError) => {
          this.log.error(`Failed to restart previous plugin "${pluginKey}" after update failure`, restoreError);
        });
        throw error;
      }
    }
    return this.listCatalog();
  }

  async enable(pluginKey: string): Promise<PluginCatalogRow[]> {
    const record = await this.requireRecord(pluginKey);
    if (this.runtimes.has(pluginKey)) {
      await this.options.registryStore.updatePlugin(pluginKey, {
        enabled: true,
        status: "enabled",
        error: null
      });
      return this.listCatalog();
    }
    try {
      await this.startRuntime(record);
      await this.options.registryStore.updatePlugin(pluginKey, {
        enabled: true,
        status: "enabled",
        error: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.options.registryStore.updatePlugin(pluginKey, {
        enabled: false,
        status: "broken",
        error: message
      });
      await this.notifyCatalogChanged();
      throw error;
    }
    return this.listCatalog();
  }

  async disable(pluginKey: string): Promise<PluginCatalogRow[]> {
    await this.stopRuntime(pluginKey);
    await this.options.registryStore.updatePlugin(pluginKey, {
      enabled: false,
      status: "disabled",
      error: null
    });
    return this.listCatalog();
  }

  async delete(pluginKey: string): Promise<PluginCatalogRow[]> {
    const record = await this.requireRecord(pluginKey);
    const hadRuntime = this.runtimes.has(pluginKey);
    let hadContributions = false;
    try {
      hadContributions = await this.stopRuntime(pluginKey, { notifyContributionsRemoved: false });
      await fs.rm(getPluginVersionsPath(this.options.rootDir, pluginKey), { recursive: true, force: true });
      await this.options.registryStore.deletePlugin(pluginKey);
      this.deletePluginConfig(pluginKey);
      if (hadContributions) {
        await this.notifyPluginContributionsRemoved(pluginKey);
      }
      return this.listCatalog();
    } catch (error) {
      if (hadRuntime && record.enabled && !this.runtimes.has(pluginKey)) {
        await this.restoreRuntimeAfterDeleteFailure(record, error);
      }
      throw error;
    }
  }

  async loadEnabledPlugins(): Promise<void> {
    const records = await this.options.registryStore.listPlugins();
    for (const record of records) {
      if (!record.enabled) {
        continue;
      }
      await this.enable(record.pluginKey).catch(async (error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.log.error(`Failed to load plugin "${record.pluginKey}"`, error);
        await this.options.registryStore.updatePlugin(record.pluginKey, {
          enabled: false,
          status: "broken",
          error: message
        });
      });
    }
  }

  async shutdown(): Promise<void> {
    for (const pluginKey of Array.from(this.runtimes.keys())) {
      await this.stopRuntime(pluginKey);
    }
  }

  async refreshRuntimeConfigs(): Promise<void> {
    const records = await this.options.registryStore.listPlugins();
    let catalogChanged = false;
    for (const record of records) {
      const runtime = this.runtimes.get(record.pluginKey);
      if (!runtime) {
        continue;
      }
      const manifest = record.manifest;
      const config = this.options.getSettings().plugins[record.pluginKey]?.config ?? {};
      try {
        await runtime.updateConfig({
          config,
          allowedNetworkHosts: getAllowedNetworkHosts(manifest, config),
          readableFiles: getReadableFiles(manifest, config)
        });
        const mediaSource = runtime.getMediaSourceAdapter();
        if (mediaSource?.handleSettingsUpdated) {
          await mediaSource.handleSettingsUpdated(config);
        }
      } catch (error) {
        await this.stopRuntime(record.pluginKey);
        const message = error instanceof Error ? error.message : String(error);
        await this.options.registryStore.updatePlugin(record.pluginKey, {
          enabled: false,
          status: "broken",
          error: message
        });
        catalogChanged = true;
      }
    }
    if (catalogChanged) {
      await this.notifyCatalogChanged();
    }
  }

  async listCatalog(): Promise<PluginCatalogRow[]> {
    const records = await this.options.registryStore.listPlugins();
    const rows = await Promise.all(records.map((record) => this.toCatalogRow(record)));
    rows.sort((left, right) => left.displayName.localeCompare(right.displayName));
    return rows;
  }

  async lookupWord(token: string): Promise<unknown> {
    return this.contributions.lookupWord(token);
  }

  getWordLookupProvider(): { pluginKey: string; provider: WordLookupProvider } | null {
    return this.contributions.getWordLookupProvider();
  }

  getTranscriptionProvider(): { pluginKey: string; provider: TranscriptionProvider } | null {
    return this.contributions.getTranscriptionProvider();
  }

  getMediaSourceAdapters(): Array<{ pluginKey: string; adapter: MediaSourceAdapter }> {
    return this.contributions.getMediaSourceAdapters();
  }

  private async startRuntime(record: InstalledPluginRecord): Promise<void> {
    const manifest = record.manifest;
    const config = this.options.getSettings().plugins[record.pluginKey]?.config ?? {};
    const entryPath = path.join(getPluginInstallPath(this.options.rootDir, record.pluginKey, manifest.version), manifest.entry.main);
    await assertRuntimeEntryExists(entryPath, record.pluginKey);
    let runtime: PluginRuntime | null = null;
    runtime = await this.createRuntime({
      pluginKey: record.pluginKey,
      entryPath,
      permissions: manifest.permissions,
      config,
      allowedNetworkHosts: getAllowedNetworkHosts(manifest, config),
      readableFiles: getReadableFiles(manifest, config),
      onRuntimeExit: (error) => {
        void this.handleRuntimeExit(record.pluginKey, error);
      },
      onContributionsChanged: () => {
        if (runtime && this.runtimes.has(record.pluginKey)) {
          this.registerRuntimeContributions(record.pluginKey, runtime);
        }
      }
    });
    this.runtimes.set(record.pluginKey, runtime);
    this.registerRuntimeContributions(record.pluginKey, runtime);
  }

  private async stopRuntime(
    pluginKey: string,
    options: { notifyContributionsRemoved?: boolean } = {}
  ): Promise<boolean> {
    const runtime = this.runtimes.get(pluginKey);
    this.runtimes.delete(pluginKey);
    const hadContributions = this.contributions.unregisterPlugin(pluginKey);
    if (hadContributions && options.notifyContributionsRemoved !== false) {
      await this.notifyPluginContributionsRemoved(pluginKey);
    }
    if (runtime) {
      await runtime.stop();
    }
    return hadContributions;
  }

  private async handleRuntimeExit(pluginKey: string, error: Error): Promise<void> {
    if (!this.runtimes.has(pluginKey)) {
      return;
    }
    this.runtimes.delete(pluginKey);
    const hadContributions = this.contributions.unregisterPlugin(pluginKey);
    if (hadContributions) {
      await this.notifyPluginContributionsRemoved(pluginKey);
    }
    this.log.error(`Plugin "${pluginKey}" runtime exited`, error);
    await this.options.registryStore.updatePlugin(pluginKey, {
      enabled: false,
      status: "broken",
      error: error.message
    });
    await this.notifyCatalogChanged();
  }

  private async restoreRuntimeAfterDeleteFailure(record: InstalledPluginRecord, deleteError: unknown): Promise<void> {
    try {
      await this.startRuntime(record);
      await this.options.registryStore.updatePlugin(record.pluginKey, {
        enabled: true,
        status: "enabled",
        error: null
      });
    } catch (restoreError) {
      this.log.error(`Failed to restore plugin "${record.pluginKey}" after delete failure`, restoreError);
      const deleteMessage = deleteError instanceof Error ? deleteError.message : String(deleteError);
      const restoreMessage = restoreError instanceof Error ? restoreError.message : String(restoreError);
      await this.options.registryStore.updatePlugin(record.pluginKey, {
        enabled: false,
        status: "broken",
        error: `Delete failed: ${deleteMessage}; restore failed: ${restoreMessage}`
      });
      await this.notifyCatalogChanged();
    }
  }

  private async createRuntime(input: PluginRuntimeStartInput): Promise<PluginRuntime> {
    const runtimeInput = {
      ...input,
      transcriptionRuntime: this.options.transcriptionRuntime
    };
    return this.options.createRuntime
      ? this.options.createRuntime(runtimeInput)
      : PluginRuntimeHost.start(runtimeInput);
  }

  private async notifyCatalogChanged(): Promise<void> {
    try {
      await this.options.onCatalogChanged?.();
    } catch (error) {
      this.log.error("Failed to notify plugin catalog change", error);
    }
  }

  private async notifyPluginContributionsRemoved(pluginKey: string): Promise<void> {
    try {
      await this.options.onPluginContributionsRemoved?.(pluginKey);
    } catch (error) {
      this.log.error(`Failed to notify plugin contribution removal for "${pluginKey}"`, error);
    }
  }

  private registerRuntimeContributions(pluginKey: string, runtime: PluginRuntime): void {
    const wordLookup = runtime.getWordLookupProvider();
    if (wordLookup) {
      this.contributions.registerWordLookupProvider(pluginKey, wordLookup);
    }
    const transcription = runtime.getTranscriptionProvider();
    if (transcription) {
      this.contributions.registerTranscriptionProvider(pluginKey, transcription);
    }
    const mediaSource = runtime.getMediaSourceAdapter();
    if (mediaSource) {
      this.contributions.registerMediaSourceAdapter(pluginKey, mediaSource);
    }
  }

  private async requireRecord(pluginKey: string): Promise<InstalledPluginRecord> {
    const record = await this.options.registryStore.getPlugin(pluginKey);
    if (!record) {
      throw new Error(`Plugin "${pluginKey}" is not installed.`);
    }
    return record;
  }

  private async toCatalogRow(record: InstalledPluginRecord): Promise<PluginCatalogRow> {
    const manifest = record.manifest;
    return {
      pluginKey: record.pluginKey,
      id: manifest.id,
      author: manifest.author,
      version: manifest.version,
      displayName: manifest.displayName,
      description: manifest.description,
      sourceUrl: record.sourceUrl,
      status: record.status,
      enabled: record.enabled,
      error: record.error,
      permissions: manifest.permissions,
      settings: manifest.contributions?.settings,
      contributions: manifest.contributions
    };
  }

  private ensurePluginConfig(manifest: PluginManifest): void {
    const pluginKey = derivePluginKey(manifest);
    const settings = this.options.getSettings();
    if (settings.plugins[pluginKey]) {
      return;
    }
    this.options.replaceSettings({
      ...settings,
      plugins: {
        ...settings.plugins,
        [pluginKey]: {
          config: defaultConfigFromSettings(manifest.contributions?.settings ?? [])
        }
      }
    });
  }

  private deletePluginConfig(pluginKey: string): void {
    const settings = this.options.getSettings();
    if (!settings.plugins[pluginKey]) {
      return;
    }
    const plugins = { ...settings.plugins };
    delete plugins[pluginKey];
    this.options.replaceSettings({
      ...settings,
      plugins
    });
  }
}

function defaultConfigFromSettings(settings: PluginSettingsContribution[]): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const section of settings) {
    for (const field of section.schema) {
      config[field.id] = defaultValueForField(field);
    }
  }
  return config;
}

function defaultValueForField(field: PluginSettingsFieldSchema): unknown {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  switch (field.type) {
    case "serverList":
      return [];
    case "boolean":
      return false;
    case "number":
      return 0;
    default:
      return "";
  }
}

async function assertRuntimeEntryExists(entryPath: string, pluginKey: string): Promise<void> {
  const stats = await fs.stat(entryPath);
  if (!stats.isFile()) {
    throw new Error(`${pluginKey} plugin entry is not a file`);
  }
}

function getAllowedNetworkHosts(manifest: PluginManifest, config: Record<string, unknown>): string[] {
  const hosts = new Set<string>();
  for (const host of manifest.network?.allowedHosts ?? []) {
    const normalized = normalizeHost(host);
    if (normalized) {
      hosts.add(normalized);
    }
  }
  collectNetworkHosts(config, hosts);
  return Array.from(hosts);
}

function collectNetworkHosts(value: unknown, hosts: Set<string>): void {
  if (typeof value === "string") {
    collectNetworkHostFromString(value, hosts);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectNetworkHosts(item, hosts);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      collectNetworkHosts(item, hosts);
    }
  }
}

function collectNetworkHostFromString(value: string, hosts: Set<string>): void {
  if (!URL.canParse(value)) {
    return;
  }
  const host = normalizeHost(new URL(value).host);
  if (host) {
    hosts.add(host);
  }
}

function getReadableFiles(manifest: PluginManifest, config: Record<string, unknown>): string[] {
  const files = new Set<string>();
  for (const section of manifest.contributions?.settings ?? []) {
    for (const field of section.schema) {
      if (field.type !== "file") {
        continue;
      }
      const value = config[field.id];
      if (typeof value === "string" && value.trim()) {
        files.add(path.resolve(value));
      }
    }
  }
  return Array.from(files);
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase();
}

function assertPluginIdentity(expectedKey: string | null, actualKey: string, context: string): void {
  if (actualKey !== expectedKey) {
    throw new Error(`Plugin ${context} for ${expectedKey} returned ${actualKey}.`);
  }
}

function assertUpdateSourcePluginKey(pluginKey: string, actualKey: string): void {
  if (actualKey !== pluginKey) {
    throw new Error(`Plugin update source for ${pluginKey} returned ${actualKey}.`);
  }
}
