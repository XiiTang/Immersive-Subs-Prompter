import { AppEventBus } from "./appEventBus.js";
import { StateManager } from "./stateManager.js";
import { JellyfinembySubtitleService } from "./jellyfinemby/index.js";
import { SubtitleCacheManager } from "./subtitleCacheManager.js";
import { createLogger } from "./logger.js";
import { AppSettings } from "./types.js";
import { TabContextRegistry } from "./mediaServer/TabContextRegistry.js";
import { MediaServerUrlResolver } from "./mediaServer/MediaServerUrlResolver.js";
import { MediaServerSessionHandler } from "./mediaServer/MediaServerSessionHandler.js";
import { MediaServerMessageHandler } from "./mediaServer/MediaServerMessageHandler.js";
import { MediaServerStatusHandler } from "./mediaServer/MediaServerStatusHandler.js";

type MediaServerControllerOptions = {
  bus: AppEventBus;
  stateManager: StateManager;
  getSettings: () => AppSettings;
  cacheManager: SubtitleCacheManager;
};

export class MediaServerController {
  private readonly log = createLogger("mediaserver-controller");
  private readonly mediaServerService: JellyfinembySubtitleService;
  private readonly tabRegistry: TabContextRegistry;
  private readonly urlResolver: MediaServerUrlResolver;
  private readonly sessionHandler: MediaServerSessionHandler;
  private readonly messageHandler: MediaServerMessageHandler;
  private readonly statusHandler: MediaServerStatusHandler;

  constructor(private readonly options: MediaServerControllerOptions) {
    this.mediaServerService = new JellyfinembySubtitleService(
      () => this.options.getSettings().mediaServer,
      this.options.cacheManager
    );
    this.tabRegistry = new TabContextRegistry();
    this.urlResolver = new MediaServerUrlResolver(this.options.getSettings);
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
      this.options.getSettings
    );
    this.statusHandler = new MediaServerStatusHandler(
      this.options.stateManager,
      this.mediaServerService,
      this.tabRegistry
    );
  }

  start() {
    this.registerBusListeners();
    this.registerServiceListeners();
    this.mediaServerService.start();
  }

  handleSettingsUpdated() {
    this.mediaServerService.refresh();
  }

  private registerBusListeners() {
    this.options.bus.on("connection:message", (event) => this.messageHandler.handleConnectionMessage(event));
    this.options.bus.on("connection:tab-removed", ({ tabId }) => this.tabRegistry.clear(tabId));
    this.options.bus.on("state:connection-count", ({ count }) => {
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
}
