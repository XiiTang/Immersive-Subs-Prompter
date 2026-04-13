import { Logger } from "../../shared/Logger";
import type { MediaStateRecord, VideoStatePayload } from "../../shared/types";

export const MINIMUM_DURATION = 10000;

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

  isValidMedia(payload: VideoStatePayload | null | undefined): payload is VideoStatePayload {
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
    return true;
  }

  setState(tabId: number, patch: Partial<MediaStateRecord> = {}, lastEventType?: string): MediaStateRecord | null {
    if (typeof tabId !== "number" || !patch || typeof patch !== "object") return null;
    const prev = this.mediaStates.get(tabId);
    if (!prev && !this.isValidMedia(patch as VideoStatePayload)) {
      return null;
    }
    const base = prev || ({ ...(patch as VideoStatePayload), tabId, lastEventType: lastEventType || "video-context" } as MediaStateRecord);
    const next: MediaStateRecord = {
      ...base,
      ...patch,
      tabId,
      lastEventType: lastEventType || base.lastEventType || "video-context",
      updatedAt: Date.now()
    };
    this.mediaStates.set(tabId, next);
    this.onChange?.(this.mediaStates);
    return next;
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
