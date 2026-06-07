import path from "node:path";
import { app } from "electron";
import { splitPluginKey } from "./pluginIdentity.js";

export function getPluginRootPath(): string {
  return path.join(app.getPath("userData"), "plugins");
}

export function getRegistryPath(rootDir = getPluginRootPath()): string {
  return path.join(rootDir, "registry.json");
}

export function getPluginTmpPath(rootDir = getPluginRootPath()): string {
  return path.join(rootDir, "tmp");
}

export function getInstalledPluginsPath(rootDir = getPluginRootPath()): string {
  return path.join(rootDir, "installed");
}

export function getPluginInstallPath(rootDir: string, pluginKey: string, version: string): string {
  const { authorId, pluginId } = splitPluginKey(pluginKey);
  return path.join(getInstalledPluginsPath(rootDir), authorId, pluginId, version);
}

export function getPluginVersionsPath(rootDir: string, pluginKey: string): string {
  const { authorId, pluginId } = splitPluginKey(pluginKey);
  return path.join(getInstalledPluginsPath(rootDir), authorId, pluginId);
}
