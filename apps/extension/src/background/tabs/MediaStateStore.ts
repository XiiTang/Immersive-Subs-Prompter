import { Logger } from "../../shared/Logger";
import type { VideoStateSnapshot } from "@immersive-subs/contracts";
import type { MediaStateRecord } from "../../shared/types";
import { projectMediaStateRecord } from "./MediaStateSelectors";

const MINIMUM_DURATION = 10000;
const PLAYBACK_SAMPLE_EVENTS = new Set(["video-context", "time-update", "playback-rate"]);

export class MediaStateStore {
  logger: Logger;
  minDuration: number;
  onChange?: (states: Map<number, MediaStateRecord>) => void;
  mediaStates: Map<number, MediaStateRecord>;

  constructor({
    logger = new Logger("media-state"),
    minDuration = MINIMUM_DURATION,
    onChange
  }: {
    logger?: Logger;
    minDuration?: number;
    onChange?: (states: Map<number, MediaStateRecord>) => void;
  } = {}) {
    this.logger = logger;
    this.minDuration = minDuration;
    this.onChange = onChange;
    this.mediaStates = new Map();
  }

  isValidMedia(payload: VideoStateSnapshot | null | undefined): payload is VideoStateSnapshot {
    if (!payload) return false;
    if (!payload.readyState) {
      this.logger.debug("filter", "Filtered: no readyState");
      return false;
    }
    const duration = typeof payload.duration === "number" && Number.isFinite(payload.duration) ? payload.duration : 0;
    if (duration <= this.minDuration) {
      this.logger.debug("filter", `Filtered: duration=${duration}s`);
      return false;
    }
    if (!isNonNegativeFiniteNumber(payload.currentTime)) {
      this.logger.debug("filter", "Filtered: invalid currentTime");
      return false;
    }
    if (!isPositiveFiniteNumber(payload.updatedAt)) {
      this.logger.debug("filter", "Filtered: invalid updatedAt");
      return false;
    }
    if (!isPositiveFiniteNumber(payload.playbackRate)) {
      this.logger.debug("filter", "Filtered: invalid playbackRate");
      return false;
    }
    if (typeof payload.paused !== "boolean") {
      this.logger.debug("filter", "Filtered: invalid paused state");
      return false;
    }
    return true;
  }

  setState(tabId: number, patch: Partial<MediaStateRecord> = {}, lastEventType?: string): MediaStateRecord | null {
    if (typeof tabId !== "number" || !patch || typeof patch !== "object") return null;
    const eventType = lastEventType || "video-context";
    const prev = this.mediaStates.get(tabId);
    if (isPlaybackSampleEvent(eventType)) {
      if (!this.isValidMedia(patch as VideoStateSnapshot)) {
        return null;
      }
      const base =
        prev ||
        ({ ...(patch as VideoStateSnapshot), tabId, lastEventType: eventType } as MediaStateRecord);
      const merged: MediaStateRecord = {
        ...base,
        ...(patch as VideoStateSnapshot),
        tabId,
        lastEventType: eventType
      };
      const next = projectMediaStateRecord(merged, Date.now());
      this.mediaStates.set(tabId, next);
      this.onChange?.(this.mediaStates);
      return next;
    }
    if (!prev) {
      return null;
    }
    const merged: MediaStateRecord = {
      ...prev,
      tabId,
      pageUrl: typeof patch.pageUrl === "string" ? patch.pageUrl : prev.pageUrl,
      title: typeof patch.title === "string" ? patch.title : prev.title,
      lastEventType: eventType
    };
    this.mediaStates.set(tabId, merged);
    this.onChange?.(this.mediaStates);
    return merged;
  }

  removeState(tabId: number): boolean {
    if (!this.mediaStates.has(tabId)) return false;
    this.mediaStates.delete(tabId);
    this.onChange?.(this.mediaStates);
    return true;
  }

  has(tabId: number): boolean {
    return this.mediaStates.has(tabId);
  }

  get(tabId: number): MediaStateRecord | undefined {
    return this.mediaStates.get(tabId);
  }

  list(): MediaStateRecord[] {
    return [...this.mediaStates.values()];
  }
}

function isPlaybackSampleEvent(eventType: string): boolean {
  return PLAYBACK_SAMPLE_EVENTS.has(eventType);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
