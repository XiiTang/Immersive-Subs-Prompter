export interface PluginSettingsContribution {
  id: string;
  title: string;
}

export interface PluginManifest {
  id: `official.${string}`;
  version: string;
  displayName: string;
  description: string;
  settings: PluginSettingsContribution[];
}

export interface PluginMainContribution {
  commands: Record<string, (...args: unknown[]) => Promise<unknown>>;
  dispose?: () => void;
}
