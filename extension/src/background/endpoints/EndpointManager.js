import { Logger } from "../../shared/Logger.js";
import { normalizeEndpointList } from "../../shared/endpoint-utils.js";

export class EndpointManager {
  constructor({ logger = new Logger("endpoints"), storageKey, defaultEndpoints = [], onChange } = {}) {
    this.logger = logger;
    this.storageKey = storageKey;
    this.defaultEndpoints = defaultEndpoints;
    this.onChange = onChange;
    this.endpoints = [...defaultEndpoints];
  }

  getEndpoints() {
    return [...this.endpoints];
  }

  async load() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get([this.storageKey], (result) => {
          if (chrome.runtime?.lastError) {
            this.logger.error("storage", "Failed to load server endpoints", chrome.runtime.lastError);
            resolve([...this.defaultEndpoints]);
            return;
          }
          const stored = normalizeEndpointList(result?.[this.storageKey]);
          const hasKey = result && Object.prototype.hasOwnProperty.call(result, this.storageKey);
          resolve(hasKey ? stored : stored.length ? stored : [...this.defaultEndpoints]);
        });
      } catch (error) {
        this.logger.error("storage", "Failed to load server endpoints", error);
        resolve([...this.defaultEndpoints]);
      }
    });
  }

  persist(endpoints) {
    try {
      chrome.storage.local.set({ [this.storageKey]: endpoints }, () => {
        if (chrome.runtime?.lastError) {
          this.logger.error("storage", "Failed to persist server endpoints", chrome.runtime.lastError);
        }
      });
    } catch (error) {
      this.logger.error("storage", "Failed to persist server endpoints", error);
    }
  }

  set(endpoints, { persist = true, fallbackToDefault = false } = {}) {
    const normalized = normalizeEndpointList(endpoints);
    this.endpoints = normalized.length || !fallbackToDefault ? normalized : [...this.defaultEndpoints];
    if (persist) {
      this.persist(this.endpoints);
    }
    this.onChange?.(this.endpoints);
    return this.getEndpoints();
  }

  add(endpoint) {
    if (typeof endpoint !== "string") return this.getEndpoints();
    return this.set([...this.endpoints, endpoint]);
  }

  remove(endpoint) {
    if (typeof endpoint !== "string") return this.getEndpoints();
    return this.set(this.endpoints.filter((item) => item !== endpoint));
  }
}
