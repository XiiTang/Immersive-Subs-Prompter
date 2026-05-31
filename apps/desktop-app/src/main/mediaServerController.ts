import { AppEventBus } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { JellyfinembySubtitleService } from "./jellyfinemby/JellyfinembySubtitlesService.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { createLogger } from "./logger.js";
import type { AppSettings, JellyfinembyPluginConfig } from "./types.js";
import { JellyfinembyUrlResolver } from "./jellyfinemby/JellyfinembyUrlResolver.js";
import { JellyfinembySessionHandler } from "./jellyfinemby/JellyfinembySessionHandler.js";
import { JellyfinembyMessageHandler } from "./jellyfinemby/JellyfinembyMessageHandler.js";
import { JellyfinembyStatusHandler } from "./jellyfinemby/JellyfinembyStatusHandler.js";
import { JELLYFINEMBY_PLUGIN_ID } from "../common/pluginIds.js";
import type { JellyfinembyRuntimeSettings, JellyfinembyTabContext } from "./jellyfinemby/types.js";

type MediaServerControllerOptions = {
  bus: AppEventBus;
  stateManager: StateManager;
  getSettings: () => AppSettings;
  cacheManager: SubtitleCacheManager;
  createService?: (
    settingsProvider: () => JellyfinembyRuntimeSettings,
    cacheManager: SubtitleCacheManager
  ) => JellyfinembySubtitleService;
};

export class MediaServerController {
  private readonly log = createLogger("jellyfinemby-controller");
  private readonly jellyfinembyService: JellyfinembySubtitleService;
  private readonly tabContexts = new Map<number, JellyfinembyTabContext>();
  private readonly urlResolver: JellyfinembyUrlResolver;
  private readonly sessionHandler: JellyfinembySessionHandler;
  private readonly messageHandler: JellyfinembyMessageHandler;
  private readonly statusHandler: JellyfinembyStatusHandler;
  private active = false;
  private listenersRegistered = false;

  constructor(private readonly options: MediaServerControllerOptions) {
    const settingsProvider = () => ({
      enabled: this.active,
      servers: this.getJellyfinembyConfig().servers
    });
    this.jellyfinembyService = (
      this.options.createService ??
      ((provider, cacheManager) => new JellyfinembySubtitleService(provider, cacheManager))
    )(settingsProvider, this.options.cacheManager);
    this.urlResolver = new JellyfinembyUrlResolver(() => this.getJellyfinembyConfig());
    this.sessionHandler = new JellyfinembySessionHandler(
      this.options.stateManager,
      this.jellyfinembyService,
      this.tabContexts,
      this.urlResolver
    );
    this.messageHandler = new JellyfinembyMessageHandler(
      this.options.stateManager,
      this.jellyfinembyService,
      this.tabContexts,
      this.urlResolver,
      () => this.active
    );
    this.statusHandler = new JellyfinembyStatusHandler(
      this.options.stateManager,
      this.jellyfinembyService,
      this.tabContexts
    );
  }

  start() {
    if (this.listenersRegistered) {
      return;
    }
    this.listenersRegistered = true;
    this.registerBusListeners();
    this.registerServiceListeners();
  }

  activate() {
    this.start();
    if (this.active) {
      return;
    }
    this.active = true;
    this.jellyfinembyService.start();
  }

  deactivate() {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.jellyfinembyService.stop();
    this.jellyfinembyService.setActiveSession(null);
    this.clearRuntimeState();
  }

  isActive(): boolean {
    return this.active;
  }

  handleSettingsUpdated() {
    if (!this.active) {
      return;
    }
    this.jellyfinembyService.refresh();
  }

  private registerBusListeners() {
    this.options.bus.on("connection:message", (event) => this.messageHandler.handleConnectionMessage(event));
    this.options.bus.on("connection:tab-removed", ({ tabId }) => this.tabContexts.delete(tabId));
    this.options.bus.on("state:connection-count", ({ count }) => {
      if (!this.active) {
        return;
      }
      const continuous = count === 0;
      this.jellyfinembyService.setContinuousSessionPolling(continuous);
    });
  }

  private registerServiceListeners() {
    this.jellyfinembyService.on("status", (payload) => this.statusHandler.handleMediaServerStatusUpdate(payload));
    this.jellyfinembyService.on("sessions", (sessions) => this.sessionHandler.handleMediaServerSessionsUpdate(sessions));
    this.jellyfinembyService.on("subtitles", (payload) => this.statusHandler.handleMediaServerSubtitlesUpdate(payload));
    this.jellyfinembyService.on("playback", (payload) => this.statusHandler.handleMediaServerPlaybackUpdate(payload));
    this.jellyfinembyService.on("error", (error) => {
      this.log.error("Media server service error", error);
    });
  }

  private getJellyfinembyConfig() {
    const config = this.options.getSettings().plugins[JELLYFINEMBY_PLUGIN_ID]?.config;
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error("Missing Jellyfin / Emby plugin config.");
    }
    return config as unknown as JellyfinembyPluginConfig;
  }

  private clearRuntimeState() {
    this.tabContexts.clear();
    this.options.stateManager.resetSubtitleState();
    this.options.stateManager.updateState((draft) => {
      draft.mediaServer = {
        connected: false,
        sessions: [],
        selectedSessionId: null,
        lastUpdated: null
      };
      draft.pendingMediaServerItemId = null;
      if (draft.activeSource === "mediaserver") {
        draft.activeSource = draft.connectionCount > 0 ? "extension" : null;
        draft.status = draft.connectionCount > 0 ? "awaiting-video" : "idle";
        draft.title = null;
        draft.pageUrl = null;
        draft.videoUrl = null;
        draft.site = null;
      }
    });
  }
}
