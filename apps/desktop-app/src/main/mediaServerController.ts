import { AppEventBus } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { JellyfinembySubtitleService } from "./jellyfinemby/index.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { createLogger } from "./logger.js";
import type { AppSettings, JellyfinembyPluginConfig, MediaServerSettings } from "./types.js";
import { TabContextRegistry } from "./mediaServer/TabContextRegistry.js";
import { MediaServerUrlResolver } from "./mediaServer/MediaServerUrlResolver.js";
import { MediaServerSessionHandler } from "./mediaServer/MediaServerSessionHandler.js";
import { MediaServerMessageHandler } from "./mediaServer/MediaServerMessageHandler.js";
import { MediaServerStatusHandler } from "./mediaServer/MediaServerStatusHandler.js";
import { toMediaServerSettings } from "./settings/sanitizers/jellyfinembySanitizer.js";
import { JELLYFINEMBY_PLUGIN_ID } from "../common/pluginIds.js";

type MediaServerControllerOptions = {
  bus: AppEventBus;
  stateManager: StateManager;
  getSettings: () => AppSettings;
  cacheManager: SubtitleCacheManager;
  createService?: (
    settingsProvider: () => MediaServerSettings,
    cacheManager: SubtitleCacheManager
  ) => MediaServerRuntimeService;
};

type MediaServerRuntimeService = Pick<
  JellyfinembySubtitleService,
  | "start"
  | "stop"
  | "refresh"
  | "on"
  | "setContinuousSessionPolling"
  | "setActiveSession"
  | "requestSessionsBurst"
>;

export class MediaServerController {
  private readonly log = createLogger("mediaserver-controller");
  private readonly mediaServerService: MediaServerRuntimeService;
  private readonly tabRegistry: TabContextRegistry;
  private readonly urlResolver: MediaServerUrlResolver;
  private readonly sessionHandler: MediaServerSessionHandler;
  private readonly messageHandler: MediaServerMessageHandler;
  private readonly statusHandler: MediaServerStatusHandler;
  private active = false;
  private listenersRegistered = false;

  constructor(private readonly options: MediaServerControllerOptions) {
    const settingsProvider = () =>
      toMediaServerSettings(
        this.getJellyfinembyConfig(),
        this.active
      );
    this.mediaServerService = (
      this.options.createService ??
      ((provider, cacheManager) => new JellyfinembySubtitleService(provider, cacheManager))
    )(settingsProvider, this.options.cacheManager);
    this.tabRegistry = new TabContextRegistry();
    this.urlResolver = new MediaServerUrlResolver(() => this.getJellyfinembyConfig());
    this.sessionHandler = new MediaServerSessionHandler(
      this.options.stateManager,
      this.mediaServerService,
      this.tabRegistry,
      this.urlResolver
    );
    this.messageHandler = new MediaServerMessageHandler(
      this.options.stateManager,
      this.mediaServerService,
      this.tabRegistry,
      this.urlResolver,
      () => this.active
    );
    this.statusHandler = new MediaServerStatusHandler(
      this.options.stateManager,
      this.mediaServerService,
      this.tabRegistry
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
    this.mediaServerService.start();
  }

  deactivate() {
    if (!this.active) {
      return;
    }
    this.active = false;
    this.mediaServerService.stop();
    this.mediaServerService.setActiveSession(null);
    this.clearRuntimeState();
  }

  isActive(): boolean {
    return this.active;
  }

  handleSettingsUpdated() {
    if (!this.active) {
      return;
    }
    this.mediaServerService.refresh();
  }

  private registerBusListeners() {
    this.options.bus.on("connection:message", (event) => this.messageHandler.handleConnectionMessage(event));
    this.options.bus.on("connection:tab-removed", ({ tabId }) => this.tabRegistry.clear(tabId));
    this.options.bus.on("state:connection-count", ({ count }) => {
      if (!this.active) {
        return;
      }
      const continuous = count === 0;
      this.mediaServerService.setContinuousSessionPolling(continuous);
    });
  }

  private registerServiceListeners() {
    this.mediaServerService.on("status", (payload) => this.statusHandler.handleMediaServerStatusUpdate(payload));
    this.mediaServerService.on("sessions", (sessions) => this.sessionHandler.handleMediaServerSessionsUpdate(sessions));
    this.mediaServerService.on("subtitles", (payload) => this.statusHandler.handleMediaServerSubtitlesUpdate(payload));
    this.mediaServerService.on("playback", (payload) => this.statusHandler.handleMediaServerPlaybackUpdate(payload));
    this.mediaServerService.on("error", (error) => {
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
    this.tabRegistry.clearAll();
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
