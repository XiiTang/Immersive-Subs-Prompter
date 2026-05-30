import { Logger } from "../../shared/Logger";
import { normalizeEndpointList } from "@immersive-subs/contracts";
import type { StorageKey } from "../../shared/constants";

export class EndpointManager {
  logger: Logger;
  storageKey: StorageKey;
  defaultEndpoints: string[];
  onChange?: (endpoints: string[]) => void;
  endpoints: string[];

  constructor({
    logger = new Logger("endpoints"),
    storageKey,
    defaultEndpoints = [],
    onChange
  }: {
    logger?: Logger;
    storageKey: StorageKey;
    defaultEndpoints?: string[];
    onChange?: (endpoints: string[]) => void;
  }) {
    this.logger = logger;
    this.storageKey = storageKey;
    this.defaultEndpoints = defaultEndpoints;
    this.onChange = onChange;
    this.endpoints = [...defaultEndpoints];
  }

  getEndpoints(): string[] {
    return [...this.endpoints];
  }

  async load(): Promise<string[]> {
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

  persist(endpoints: string[]) {
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

  set(endpoints: string[], { persist = true }: { persist?: boolean } = {}): string[] {
    const normalized = normalizeEndpointList(endpoints);
    this.endpoints = normalized;
    if (persist) {
      this.persist(this.endpoints);
    }
    this.onChange?.(this.endpoints);
    return this.getEndpoints();
  }

  add(endpoint: string): string[] {
    if (typeof endpoint !== "string") return this.getEndpoints();
    return this.set([...this.endpoints, endpoint]);
  }

  remove(endpoint: string): string[] {
    if (typeof endpoint !== "string") return this.getEndpoints();
    return this.set(this.endpoints.filter((item) => item !== endpoint));
  }
}
