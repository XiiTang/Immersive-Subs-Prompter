import type { FromExtensionBroadcastMessage } from "@immersive-subs/contracts";
import { normalizeServerUrl } from "../jellyfinembyUtils.js";
import { createLogger } from "../logger.js";
import type {
  AppSettings,
  MediaServerConfig,
  MediaServerSessionSummary
} from "../types.js";

export class MediaServerUrlResolver {
  private readonly log = createLogger("mediaserver-url-resolver");

  constructor(private readonly getSettings: () => AppSettings) {}

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

  resolveMediaServerConfigIdFromUrls(urls: Array<string | null | undefined>): string | null {
    const settings = this.getSettings();
    if (!settings.mediaServer.enabled || !settings.mediaServer.configs.length) {
      return null;
    }
    const configs = settings.mediaServer.configs.filter((config) => config.type === "jellyfinemby");
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
          const serverOrigin = `${serverUrl.protocol}//${serverUrl.hostname}${serverUrl.port ? ":" + serverUrl.port : ""
            }`;
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

  extractItemId(
    payload: Extract<FromExtensionBroadcastMessage, { type: "video-context" | "time-update" | "playback-rate" }>["payload"],
    fallbackUrl: string
  ): string | null {
    const extractFromUrl = (candidate: string | null | undefined): string | null => {
      if (!candidate || typeof candidate !== "string") {
        return null;
      }
      try {
        const urlObj = new URL(candidate);

        // First, try to extract from URL path (e.g., /videos/302/... or /items/302/...)
        // This matches what Emby/Jellyfin report as nowPlayingItemId
        const pathMatch = urlObj.pathname.match(/\/(?:videos|items)\/([^/]+)/i);
        if (pathMatch?.[1]) {
          return pathMatch[1];
        }

        // Fallback: try MediaSourceId parameter (but strip 'mediasource_' prefix if present)
        for (const [key, value] of urlObj.searchParams.entries()) {
          if (key.toLowerCase() === "mediasourceid") {
            // Strip 'mediasource_' prefix if present to match server-reported ID
            const cleanedValue = value.replace(/^mediasource_/i, "");
            return cleanedValue;
          }
        }
      } catch (error) {
        this.log.error(`Failed to parse media server URL for itemId`, error);
      }
      return null;
    };

    return extractFromUrl(payload.videoSrc) ?? extractFromUrl(fallbackUrl);
  }

  resolveMediaServerConfig(configId?: string | null): MediaServerConfig | null {
    const settings = this.getSettings().mediaServer;
    const configs = settings.configs.filter((config) => config.type === "jellyfinemby");
    if (configId) {
      return configs.find((config) => config.id === configId) ?? null;
    }
    const enabled = configs.find((config) => config.enabled);
    if (enabled) {
      return enabled;
    }
    return configs[0] ?? null;
  }

  getMediaServerBaseUrl(configId?: string | null): string | null {
    const config = this.resolveMediaServerConfig(configId);
    if (!config) {
      return null;
    }
    const base = normalizeServerUrl(config.serverUrl ?? "");
    return base.length ? base : null;
  }

  buildMediaServerItemUrl(session: MediaServerSessionSummary | null): string | null {
    if (!session?.nowPlayingItemId) {
      return null;
    }
    const base = this.getMediaServerBaseUrl(session.serverConfigId);
    if (!base) {
      return `jellyfinemby://${session.nowPlayingItemId}`;
    }
    return `${base}/Items/${session.nowPlayingItemId}`;
  }

  buildMediaServerPageUrl(session: MediaServerSessionSummary | null): string | null {
    if (!session) {
      return this.getMediaServerBaseUrl();
    }
    if (!session.nowPlayingItemId) {
      return this.getMediaServerBaseUrl(session.serverConfigId);
    }
    const base = this.getMediaServerBaseUrl(session.serverConfigId);
    if (!base) {
      return null;
    }
    return `${base}/web/index.html#!/details?id=${session.nowPlayingItemId}`;
  }
}
