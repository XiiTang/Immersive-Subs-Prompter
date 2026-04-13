import { EventEmitter } from "events";
import { WebSocket } from "ws";
import type {
  DesktopState,
  ExtensionMessage,
  MediaServerPlaybackPayload,
  MediaServerSessionSummary,
  MediaServerStatusPayload,
  MediaServerSubtitlesPayload,
  PlaybackState
} from "./types.js";

type MediaServerSessions = MediaServerSessionSummary[];

export interface ConnectionMessageEvent {
  message: ExtensionMessage;
  resolvedUrl: string | null;
  handled: boolean;
  markHandled: () => void;
}

export interface AppEventMap {
  "state:changed": DesktopState;
  "state:playback": PlaybackState;
  "state:connection-count": { count: number };
  "playback:loop-cleared": void;
  "connection:client-connected": { socket: WebSocket };
  "connection:client-disconnected": { socket: WebSocket };
  "connection:tab-removed": { tabId: number };
  "connection:message": ConnectionMessageEvent;
  "mediaserver:status": MediaServerStatusPayload;
  "mediaserver:sessions": MediaServerSessions;
  "mediaserver:subtitles": MediaServerSubtitlesPayload;
  "mediaserver:playback": MediaServerPlaybackPayload;
}

type AppEvent = keyof AppEventMap;
type Listener<K extends AppEvent> = (payload: AppEventMap[K]) => void;

export class AppEventBus extends EventEmitter {
  override emit<K extends AppEvent>(event: K, payload: AppEventMap[K]): boolean {
    return super.emit(event, payload);
  }

  override on<K extends AppEvent>(event: K, listener: Listener<K>): this {
    return super.on(event, listener);
  }

  override once<K extends AppEvent>(event: K, listener: Listener<K>): this {
    return super.once(event, listener);
  }

  override off<K extends AppEvent>(event: K, listener: Listener<K>): this {
    return super.off(event, listener);
  }
}
