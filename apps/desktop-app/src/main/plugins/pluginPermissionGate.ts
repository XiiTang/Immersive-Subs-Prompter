import type { PluginPermission } from "./pluginManifest.js";

export class PluginPermissionGate {
  private readonly permissions: Set<PluginPermission>;

  constructor(private readonly pluginId: string, permissions: readonly PluginPermission[]) {
    this.permissions = new Set(permissions);
  }

  require(permission: PluginPermission): void {
    if (!this.permissions.has(permission)) {
      throw new Error(`${this.pluginId} is missing permission: ${permission}`);
    }
  }

  has(permission: PluginPermission): boolean {
    return this.permissions.has(permission);
  }
}
