import type { FeatureId } from "../../../../common/featureDefaults";
import type { AppSettings, FeatureSettings } from "../../../../main/types";
import { createId } from "../helpers";
import type { DesktopStoreThis } from "../types";

type ConfigurableFeatureId = Exclude<FeatureId, "transcription">;

export async function setFeatureEnabled(
  this: DesktopStoreThis,
  featureId: FeatureId,
  enabled: boolean
) {
  if (!this.settings) {
    return;
  }
  if (featureId === "transcription") {
    await this.updateSettings({
      features: {
        transcription: {
          ...this.settings.features.transcription,
          enabled
        }
      } as Partial<FeatureSettings>
    } as Partial<AppSettings>);
    return;
  }

  const feature = this.settings.features[featureId];
  await this.updateSettings({
    features: {
      [featureId]: {
        enabled,
        config: feature.config
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}

export async function setFeatureConfig<FeatureKey extends ConfigurableFeatureId>(
  this: DesktopStoreThis,
  featureId: FeatureKey,
  config: Partial<FeatureSettings[FeatureKey]["config"]>
) {
  if (!this.settings) {
    return;
  }
  const feature = this.settings.features[featureId];
  await this.updateSettings({
    features: {
      [featureId]: {
        enabled: feature.enabled,
        config: {
          ...feature.config,
          ...config
        }
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}

function resolveActiveTranscriptionConfigId(
  configs: FeatureSettings["transcription"]["configs"],
  requestedActiveId: string
): string | null {
  const enabledConfigs = configs.filter((config) => config.enabled);
  if (!enabledConfigs.length) {
    return configs.some((config) => config.id === requestedActiveId)
      ? requestedActiveId
      : configs[0]?.id ?? null;
  }
  if (enabledConfigs.some((config) => config.id === requestedActiveId)) {
    return requestedActiveId;
  }
  return enabledConfigs[0]!.id;
}

function moveArrayItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] | null {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return null;
  }
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) {
    return null;
  }
  next.splice(toIndex, 0, moved);
  return next;
}

export async function setActiveTranscriptionConfig(this: DesktopStoreThis, configId: string) {
  if (!this.settings) {
    return;
  }
  const configs = this.settings.features.transcription.configs;
  if (!configs.some((config) => config.id === configId && config.enabled)) {
    return;
  }
  await this.updateSettings({
    features: {
      transcription: {
        ...this.settings.features.transcription,
        activeConfigId: configId
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}

export async function setTranscriptionConfigs(
  this: DesktopStoreThis,
  configs: FeatureSettings["transcription"]["configs"],
  activeConfigId: string
) {
  if (!this.settings) {
    return;
  }
  const resolvedActiveId = resolveActiveTranscriptionConfigId(configs, activeConfigId);
  if (!resolvedActiveId) {
    return;
  }
  await this.updateSettings({
    features: {
      transcription: {
        enabled: this.settings.features.transcription.enabled,
        activeConfigId: resolvedActiveId,
        configs
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}

export async function toggleTranscriptionConfigEnabled(
  this: DesktopStoreThis,
  configId: string,
  enabled: boolean
) {
  if (!this.settings) {
    return;
  }
  const feature = this.settings.features.transcription;
  if (!feature.configs.some((config) => config.id === configId)) {
    return;
  }
  const configs = feature.configs.map((config) =>
    config.id === configId ? { ...config, enabled } : config
  );
  await setTranscriptionConfigs.call(this, configs, feature.activeConfigId);
}

export async function reorderTranscriptionConfig(
  this: DesktopStoreThis,
  fromIndex: number,
  toIndex: number
) {
  if (!this.settings) {
    return;
  }
  const feature = this.settings.features.transcription;
  const configs = moveArrayItem(feature.configs, fromIndex, toIndex);
  if (!configs) {
    return;
  }
  await setTranscriptionConfigs.call(this, configs, feature.activeConfigId);
}

async function writeJellyfinEmbyServers(
  this: DesktopStoreThis,
  servers: FeatureSettings["jellyfinEmby"]["config"]["servers"]
) {
  if (!this.settings) {
    return;
  }
  await this.updateSettings({
    features: {
      jellyfinEmby: {
        enabled: this.settings.features.jellyfinEmby.enabled,
        config: { servers }
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
}

export async function duplicateJellyfinEmbyServer(
  this: DesktopStoreThis,
  serverId: string
): Promise<string | null> {
  if (!this.settings) {
    return null;
  }
  const servers = this.settings.features.jellyfinEmby.config.servers;
  const sourceIndex = servers.findIndex((server) => server.id === serverId);
  const source = servers[sourceIndex];
  if (!source) {
    return null;
  }
  const copy = {
    ...source,
    id: createId("jellyfin-emby"),
    name: `${source.name} Copy`
  };
  await writeJellyfinEmbyServers.call(this, [
    ...servers.slice(0, sourceIndex + 1),
    copy,
    ...servers.slice(sourceIndex + 1)
  ]);
  return copy.id;
}

export async function updateJellyfinEmbyServer(
  this: DesktopStoreThis,
  serverId: string,
  patch: Partial<FeatureSettings["jellyfinEmby"]["config"]["servers"][number]>
) {
  if (!this.settings) {
    return;
  }
  const servers = this.settings.features.jellyfinEmby.config.servers;
  const existing = servers.find((server) => server.id === serverId);
  if (!existing) {
    if (
      typeof patch.id !== "string" ||
      patch.id !== serverId ||
      typeof patch.name !== "string" ||
      typeof patch.serverUrls !== "string" ||
      typeof patch.apiKey !== "string" ||
      typeof patch.enabled !== "boolean"
    ) {
      return;
    }
    await writeJellyfinEmbyServers.call(this, [
      ...servers,
      {
        id: patch.id,
        name: patch.name,
        serverUrls: patch.serverUrls,
        apiKey: patch.apiKey,
        enabled: patch.enabled
      }
    ]);
    return;
  }
  await writeJellyfinEmbyServers.call(
    this,
    servers.map((server) =>
      server.id === serverId ? { ...server, ...patch } : server
    )
  );
}

export async function deleteJellyfinEmbyServer(this: DesktopStoreThis, serverId: string) {
  if (!this.settings) {
    return;
  }
  await writeJellyfinEmbyServers.call(
    this,
    this.settings.features.jellyfinEmby.config.servers.filter((server) => server.id !== serverId)
  );
}

export async function reorderJellyfinEmbyServer(
  this: DesktopStoreThis,
  fromIndex: number,
  toIndex: number
) {
  if (!this.settings) {
    return;
  }
  const servers = moveArrayItem(this.settings.features.jellyfinEmby.config.servers, fromIndex, toIndex);
  if (!servers) {
    return;
  }
  await writeJellyfinEmbyServers.call(this, servers);
}

export const featureActions = {
  setFeatureEnabled,
  setFeatureConfig,
  setActiveTranscriptionConfig,
  setTranscriptionConfigs,
  toggleTranscriptionConfigEnabled,
  reorderTranscriptionConfig,
  duplicateJellyfinEmbyServer,
  updateJellyfinEmbyServer,
  deleteJellyfinEmbyServer,
  reorderJellyfinEmbyServer
};
