import type { PluginManifest, PluginSettingsContribution } from "./pluginManifest.js";

type LocalPluginStatus = "disabled" | "enabled" | "broken";

export interface InstalledPluginRecord {
  id: PluginManifest["id"];
  enabled: boolean;
  error: string | null;
}

export interface PluginRegistryState {
  plugins: Record<string, InstalledPluginRecord>;
}

export interface PluginCatalogRow {
  id: PluginManifest["id"];
  version: string;
  displayName: string;
  description: string;
  status: LocalPluginStatus;
  enabled: boolean;
  error: string | null;
  settings?: PluginSettingsContribution[];
}
