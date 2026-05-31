import type { FromExtensionBroadcastMessage } from "@immersive-subs/contracts";
import { normalizeServerUrl } from "../jellyfinembyUtils.js";
import { createLogger } from "../logger.js";
import type {
  JellyfinembyPluginConfig,
  JellyfinembyServerConfig,
  MediaServerSessionSummary
} from "../types.js";

export class JellyfinembyUrlResolver {
  private readonly log = createLogger("jellyfinemby-url-resolver");

  constructor(private readonly getConfig: () => JellyfinembyPluginConfig) {}

  extractOrigin(url: string | null | undefined): string | null {
    if (!url) {
      return null;
    }
    let candidate = url.trim();
    if (!candidate) {
      return null;
    }
    if (candidate.startsWith("blob:")) {
      candidate = candidate.slice(5);
    }
    try {
      const parsed = new URL(candidate);
      return `${parsed.protocol}//${parsed.hostname}${parsed.port ? ":" + parsed.port : ""}`;
    } catch {
      return null;
    }
  }

  resolveConfigIdFromUrls(urls: Array<string | null | undefined>): string | null {
    const configs = this.getConfigs().filter((config) => config.enabled);
    for (const candidate of urls) {
      const origin = this.extractOrigin(candidate);
      if (!origin) {
        continue;
      }
      for (const config of configs) {
        if (!config.serverUrl) {
          continue;
        }
        try {
          const serverUrl = new URL(normalizeServerUrl(config.serverUrl));
          const serverOrigin = `${serverUrl.protocol}//${serverUrl.hostname}${serverUrl.port ? ":" + serverUrl.port : ""}`;
          if (serverOrigin === origin) {
            return config.id;
          }
        } catch {
          continue;
        }
      }
    }
    return null;
  }

  extractItemId(payload: Extract<FromExtensionBroadcastMessage, { type: "video-context" | "time-update" | "playback-rate" }>["payload"]): string | null {
    const extractFromUrl = (candidate: string | null | undefined): string | null => {
      if (!candidate || typeof candidate !== "string") {
        return null;
      }
      try {
        const urlObj = new URL(candidate);
        const pathMatch = urlObj.pathname.match(/\/(?:videos|items)\/([^/]+)/i);
        if (pathMatch?.[1]) {
          return pathMatch[1];
        }
      } catch (error) {
        this.log.error(`Failed to parse media server URL for itemId`, error);
      }
      return null;
    };

    return extractFromUrl(payload.videoSrc);
  }

  resolveConfig(configId?: string | null): JellyfinembyServerConfig | null {
    const configs = this.getConfigs();
    if (configId) {
      return configs.find((config) => config.id === configId) ?? null;
    }
    const enabled = configs.find((config) => config.enabled);
    if (enabled) {
      return enabled;
    }
    return null;
  }

  getBaseUrl(configId?: string | null): string | null {
    const config = this.resolveConfig(configId);
    if (!config) {
      return null;
    }
    const base = normalizeServerUrl(config.serverUrl ?? "");
    return base.length ? base : null;
  }

  buildItemUrl(session: MediaServerSessionSummary | null): string | null {
    if (!session?.nowPlayingItemId) {
      return null;
    }
    const base = this.getBaseUrl(session.serverConfigId);
    if (!base) {
      return null;
    }
    return `${base}/Items/${session.nowPlayingItemId}`;
  }

  buildPageUrl(session: MediaServerSessionSummary | null): string | null {
    if (!session) {
      return this.getBaseUrl();
    }
    if (!session.nowPlayingItemId) {
      return this.getBaseUrl(session.serverConfigId);
    }
    const base = this.getBaseUrl(session.serverConfigId);
    if (!base) {
      return null;
    }
    return `${base}/web/index.html#!/details?id=${session.nowPlayingItemId}`;
  }

  private getConfigs(): JellyfinembyServerConfig[] {
    return this.getConfig().servers;
  }
}
