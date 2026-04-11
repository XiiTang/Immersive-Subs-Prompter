import { Logger } from "../shared/Logger.js";

export const log = new Logger("content-script");

export const state = {
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
  regexCache: new Map(),
  lastReportedPlayback: null,
  loop: {
    mode: null,
    startMs: null,
    endMs: null,
    startCueIndex: null,
    endCueIndex: null,
    anchorCueIndex: null,
    origin: null,
    isLooping: false,
    programmaticSeekReason: "none",
    boundaryTransition: "none",
    checkTimer: null
  },
  domObserver: null,
  hooked: new WeakSet(),
  observedDocs: new WeakSet()
};
