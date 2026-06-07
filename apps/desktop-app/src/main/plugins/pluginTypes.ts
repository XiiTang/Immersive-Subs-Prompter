import type {
  PluginContributionDeclarations,
  PluginManifest,
  PluginPermission,
  PluginSettingsContribution
} from "./pluginManifest.js";
import type { PluginAuthor } from "./pluginIdentity.js";

export type LocalPluginStatus = "disabled" | "enabled" | "updating" | "broken";

export interface InstalledPluginRecord {
  pluginKey: string;
  manifest: PluginManifest;
  sourceUrl: string;
  enabled: boolean;
  status: LocalPluginStatus;
  error: string | null;
  installedAt: string;
  updatedAt: string;
}

export interface PluginRegistryState {
  plugins: Record<string, InstalledPluginRecord>;
}

export interface PluginCatalogRow {
  pluginKey: string;
  id: PluginManifest["id"];
  author: PluginAuthor;
  version: string;
  displayName: string;
  description: string;
  sourceUrl: string;
  status: LocalPluginStatus;
  enabled: boolean;
  error: string | null;
  permissions: PluginPermission[];
  settings?: PluginSettingsContribution[];
  contributions?: PluginContributionDeclarations;
}

export interface RecommendedPluginInstallLink {
  pluginKey: string;
  id: string;
  author: PluginAuthor;
  displayName: string;
  description: string;
  sourceUrl: string;
}
