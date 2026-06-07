import { EventEmitter } from "events";
import type { FromExtensionBroadcastMessage } from "@immersive-subs/contracts";
import type { DesktopState, PlaybackState } from "./types.js";

export interface ConnectionMessageEvent {
  message: FromExtensionBroadcastMessage;
  resolvedUrl: string | null;
  handled: boolean;
  markHandled: () => void;
  waitUntil: (promise: Promise<unknown>) => void;
}

export interface AppEventMap {
  "state:changed": DesktopState;
  "state:playback": PlaybackState;
  "state:connection-count": { count: number };
  "playback:loop-cleared": void;
  "connection:tab-removed": { tabId: number };
  "connection:message": ConnectionMessageEvent;
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
