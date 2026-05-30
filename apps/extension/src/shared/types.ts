import type {
  ControlCommandPayload,
  FromExtensionBroadcastMessage,
  LoopBoundaryTransition,
  LoopMode,
  LoopOrigin,
  ProgrammaticSeekReason,
  VideoStateSnapshot
} from "@immersive-subs/contracts";

export interface BlacklistRule {
  id: string;
  value: string;
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

export interface MediaStateRecord extends VideoStateSnapshot {
  tabId: number;
  frameId?: number;
  lastEventType?: string;
}

export interface MediaInfo extends MediaStateRecord {
  progress: number | null;
  isPlaying: boolean;
  updatedAgo: number;
}

export type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

export interface DesktopConnectionSnapshot {
  endpoint: string;
  state: ConnectionState;
  lastError: string | null;
  lastChangeAt: number;
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
  activeVideo: HTMLVideoElement | null;
  driftMonitorTimer: ReturnType<typeof setTimeout> | null;
  lastPageUrl: string;
  blacklistRules: BlacklistRule[];
  isPageBlacklisted: boolean;
  monitoringActive: boolean;
  prototypesHooked: boolean;
  urlWatcherInitialized: boolean;
  urlWatcherCleanups: Array<() => void>;
  lastReportedPlayback: PlaybackPrediction | null;
  loop: LoopRuntimeState;
  domObserver: MutationObserver | null;
  hooked: WeakSet<HTMLVideoElement>;
  observedDocs: WeakSet<Document | ShadowRoot>;
}

export type ControlMessage =
  | { type: "control"; action: "seek"; payload: ControlCommandPayload<"seek"> }
  | { type: "control"; action: "loop"; payload: ControlCommandPayload<"loop"> }
  | { type: "control"; action: "pause" }
  | { type: "control"; action: "play" }
  | { type: "control"; action: "stopLoop" };

type StripTransportEnvelope<T> = T extends unknown ? Omit<T, "source" | "sentAt" | "tabId"> : never;

export type ContentToBackgroundMessage = StripTransportEnvelope<FromExtensionBroadcastMessage>;

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
