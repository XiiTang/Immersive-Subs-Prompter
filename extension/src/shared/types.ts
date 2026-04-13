export type BlacklistMode = "contains" | "exact" | "regex";

export interface BlacklistRule {
  id: string;
  mode: BlacklistMode;
  value: string;
}

export type LoopMode = "single" | "ab";
export type LoopOrigin = "single-loop" | "ab-loop";
export type LoopStatus = "running";
export type ProgrammaticSeekReason = "none" | "loop-wrap" | "manual-control";
export type LoopBoundaryTransition = "none" | "loop-wrap";

export interface LoopSession {
  mode: LoopMode;
  startMs: number;
  endMs: number;
  startCueIndex: number | null;
  endCueIndex: number | null;
  anchorCueIndex: number | null;
  origin: LoopOrigin;
}

export interface LoopSnapshot extends LoopSession {
  status: LoopStatus;
  boundaryTransition: LoopBoundaryTransition;
  programmaticSeekReason: ProgrammaticSeekReason;
}

export interface LoopRuntimeState {
  mode: LoopMode | null;
  startMs: number | null;
  endMs: number | null;
  startCueIndex: number | null;
  endCueIndex: number | null;
  anchorCueIndex: number | null;
  origin: LoopOrigin | null;
  isLooping: boolean;
  programmaticSeekReason: ProgrammaticSeekReason;
  boundaryTransition: LoopBoundaryTransition;
  checkTimer: ReturnType<typeof setTimeout> | null;
}

export interface PlaybackPrediction {
  currentTime: number;
  playbackRate: number;
  reportedAt: number;
}

export type VideoSite = "youtube" | "bilibili" | "douyin" | "unknown";

export interface VideoStatePayload {
  pageUrl: string;
  site: VideoSite;
  videoSrc: string | null;
  videoWidth: number | null;
  videoHeight: number | null;
  pictureInPicture: boolean;
  playbackRate: number;
  currentTime: number;
  duration: number | null;
  paused: boolean;
  muted: boolean;
  volume: number;
  readyState: number;
  title: string;
  updatedAt: number;
  loop: LoopSnapshot | null;
}

export interface MediaStateRecord extends VideoStatePayload {
  tabId: number;
  frameId?: number;
  lastEventType?: string;
}

export interface MediaInfo extends MediaStateRecord {
  progress: number | null;
  isPlaying: boolean;
  updatedAgo: number;
}

export interface DesktopConnectionSnapshot {
  endpoint: string;
  state: ConnectionState;
  lastError: string | null;
  lastChangeAt: number;
  pendingMessages: number;
}

export interface DashboardSnapshot {
  generatedAt: number;
  items: MediaInfo[];
  connections: DesktopConnectionSnapshot[];
  endpoints: string[];
}

export interface TabInfo {
  lastVideoUrl: string | null;
  lastFrameId: number | null;
}

export interface ClearFrameResult {
  removedFrame: boolean;
  clearedPreferredFrame: boolean;
  tabRemoved: boolean;
}

export interface ContentRuntimeState {
  port: chrome.runtime.Port | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  keepAliveTimer: ReturnType<typeof setTimeout> | null;
  activeVideo: HTMLVideoElement | null;
  driftMonitorTimer: ReturnType<typeof setTimeout> | null;
  lastPageUrl: string;
  blacklistRules: BlacklistRule[];
  isPageBlacklisted: boolean;
  monitoringActive: boolean;
  prototypesHooked: boolean;
  urlWatcherInitialized: boolean;
  urlWatcherCleanups: Array<() => void>;
  urlFallbackTimer: ReturnType<typeof setTimeout> | null;
  regexCache: Map<string, RegExp | null>;
  lastReportedPlayback: PlaybackPrediction | null;
  loop: LoopRuntimeState;
  domObserver: MutationObserver | null;
  hooked: WeakSet<HTMLVideoElement>;
  observedDocs: WeakSet<Document | ShadowRoot>;
}

export type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

export interface ControlPayload {
  time?: number;
  mode?: LoopMode;
  startMs?: number;
  endMs?: number;
  startCueIndex?: number | null;
  endCueIndex?: number | null;
  anchorCueIndex?: number | null;
  origin?: LoopOrigin;
}

export type ControlAction = "seek" | "loop" | "stopLoop" | "pause" | "play";

export interface ControlMessage {
  type: "control";
  action: ControlAction;
  payload: ControlPayload;
}

export interface VideoEndedMessage {
  type: "video-ended";
  payload: {
    pageUrl?: string;
  };
}

export interface PageUrlChangedMessage {
  type: "page-url-changed";
  payload: {
    pageUrl: string;
    title?: string;
  };
}

export interface TimeUpdateMessage {
  type: "time-update";
  payload: VideoStatePayload;
}

export interface VideoContextMessage {
  type: "video-context";
  payload: VideoStatePayload;
}

export interface PlaybackRateMessage {
  type: "playback-rate";
  payload: VideoStatePayload;
}

export interface LoopStartedMessage {
  type: "loop-started";
  payload: LoopSession;
}

export interface LoopClearedMessage {
  type: "loop-cleared";
  payload: Record<string, never>;
}

export type ContentToBackgroundMessage =
  | VideoContextMessage
  | TimeUpdateMessage
  | PlaybackRateMessage
  | PageUrlChangedMessage
  | VideoEndedMessage
  | LoopStartedMessage
  | LoopClearedMessage;

export type BackgroundToContentMessage = ControlMessage;

export type DashboardRequestMessage =
  | { type: "server-endpoints:get" }
  | { type: "server-endpoints:add"; endpoint: string }
  | { type: "server-endpoints:remove"; endpoint: string }
  | { type: "server-endpoints:set"; endpoints: string[] };

export type DashboardResponseMessage =
  | { type: "media-state-snapshot"; payload: DashboardSnapshot }
  | {
      type: "server-endpoints";
      payload: {
        endpoints: string[];
        connections: DesktopConnectionSnapshot[];
      };
    };

export interface DesktopControlCommandMessage {
  source: "usp-desktop";
  type: "control-command";
  tabId: number;
  action: ControlAction;
  payload?: ControlPayload;
}

export interface DesktopHeartbeatMessage {
  type: "heartbeat";
  source?: string;
}

export interface DesktopHeartbeatAckMessage {
  type: "heartbeat-ack";
  source: "usp-extension";
  sentAt: number;
}

export interface DesktopOutboundEnvelope {
  source: "usp-extension";
  type: string;
  tabId?: number;
  payload?: unknown;
  sentAt: number;
}

export type DesktopInboundMessage = DesktopControlCommandMessage | DesktopHeartbeatMessage;

export type StorageChangeMap = Record<string, chrome.storage.StorageChange>;

export function createEmptyLoopState(): LoopRuntimeState {
  return {
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
  };
}
