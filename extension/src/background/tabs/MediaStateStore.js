import { Logger } from "../../shared/Logger.js";

export const MINIMUM_DURATION = 10000;

export class MediaStateStore {
  constructor({ logger = new Logger("media-state"), minDuration = MINIMUM_DURATION, onChange } = {}) {
    this.logger = logger;
    this.minDuration = minDuration;
    this.onChange = onChange;
    this.mediaStates = new Map();
  }

  isValidMedia(payload) {
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

  setState(tabId, patch = {}, lastEventType) {
    if (typeof tabId !== "number" || !patch || typeof patch !== "object") return null;
    const prev = this.mediaStates.get(tabId) || { tabId };
    const next = {
      ...prev,
      ...patch,
      tabId,
      lastEventType: lastEventType || patch.type || prev?.lastEventType,
      updatedAt: Date.now()
    };
    this.mediaStates.set(tabId, next);
    this.onChange?.(this.mediaStates);
    return next;
  }

  removeState(tabId) {
    if (!this.mediaStates.has(tabId)) return false;
    this.mediaStates.delete(tabId);
    this.onChange?.(this.mediaStates);
    return true;
  }

  has(tabId) {
    return this.mediaStates.has(tabId);
  }

  get(tabId) {
    return this.mediaStates.get(tabId);
  }

  list() {
    return [...this.mediaStates.values()];
  }
}
