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

export async function setActiveTranscriptionConfig(this: DesktopStoreThis, configId: string) {
  if (!this.settings) {
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
  await this.updateSettings({
    features: {
      transcription: {
        enabled: this.settings.features.transcription.enabled,
        activeConfigId,
        configs
      }
    } as Partial<FeatureSettings>
  } as Partial<AppSettings>);
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

export async function addJellyfinEmbyServer(this: DesktopStoreThis): Promise<string | null> {
  if (!this.settings) {
    return null;
  }
  const servers = this.settings.features.jellyfinEmby.config.servers;
  const id = createId("jellyfin-emby");
  await writeJellyfinEmbyServers.call(this, [
    ...servers,
    {
      id,
      name: `Server ${servers.length + 1}`,
      serverUrls: "",
      apiKey: "",
      enabled: false
    }
  ]);
  return id;
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
  await writeJellyfinEmbyServers.call(
    this,
    this.settings.features.jellyfinEmby.config.servers.map((server) =>
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

export const featureActions = {
  setFeatureEnabled,
  setFeatureConfig,
  setActiveTranscriptionConfig,
  setTranscriptionConfigs,
  addJellyfinEmbyServer,
  duplicateJellyfinEmbyServer,
  updateJellyfinEmbyServer,
  deleteJellyfinEmbyServer
};
