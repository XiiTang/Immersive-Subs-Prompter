import type { LoopSnapshot } from "../core/loop.js";
import type { PageUrlChangedPayload } from "../core/transport.js";
import type { VideoStateSnapshot } from "../core/video.js";

interface FromExtensionBaseMessage {
  source: "usp-extension";
  sentAt: number;
}

interface FromExtensionTabMessage extends FromExtensionBaseMessage {
  tabId: number;
}

export interface VideoContextMessage extends FromExtensionTabMessage {
  type: "video-context";
  payload: VideoStateSnapshot;
}

export interface TimeUpdateMessage extends FromExtensionTabMessage {
  type: "time-update";
  payload: VideoStateSnapshot;
}

export interface PlaybackRateMessage extends FromExtensionTabMessage {
  type: "playback-rate";
  payload: VideoStateSnapshot;
}

export interface PageUrlChangedMessage extends FromExtensionTabMessage {
  type: "page-url-changed";
  payload: PageUrlChangedPayload;
}

export interface VideoEndedMessage extends FromExtensionTabMessage {
  type: "video-ended";
  payload: Record<string, never>;
}

export interface LoopStartedMessage extends FromExtensionTabMessage {
  type: "loop-started";
  payload: LoopSnapshot;
}

export interface LoopClearedMessage extends FromExtensionTabMessage {
  type: "loop-cleared";
  payload: Record<string, never>;
}

export interface HeartbeatAckMessage extends FromExtensionBaseMessage {
  type: "heartbeat-ack";
}

export type FromExtensionMessage =
  | VideoContextMessage
  | TimeUpdateMessage
  | PlaybackRateMessage
  | PageUrlChangedMessage
  | VideoEndedMessage
  | LoopStartedMessage
  | LoopClearedMessage
  | HeartbeatAckMessage;

export type FromExtensionMediaMessage = VideoContextMessage | TimeUpdateMessage | PlaybackRateMessage;
export type FromExtensionBroadcastMessage = Exclude<FromExtensionMessage, HeartbeatAckMessage>;
