import { Logger } from "../shared/Logger";
import { createEmptyLoopState, type ContentRuntimeState } from "../shared/types";

export const log = new Logger("content-script");

export const state: ContentRuntimeState = {
  port: null,
  reconnectTimer: null,
  keepAliveTimer: null,
  activeVideo: null,
  driftMonitorTimer: null,
  lastPageUrl: location.href,
  blacklistRules: [],
  isPageBlacklisted: false,
  monitoringActive: false,
  prototypesHooked: false,
  urlWatcherInitialized: false,
  urlWatcherCleanups: [],
  urlFallbackTimer: null,
  lastReportedPlayback: null,
  loop: createEmptyLoopState(),
  domObserver: null,
  hooked: new WeakSet(),
  observedDocs: new WeakSet()
};
