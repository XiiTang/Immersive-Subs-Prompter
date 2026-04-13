import type { ClearFrameResult, TabInfo } from "../../shared/types";

export class TabRegistry {
  logger?: { info?: (...args: unknown[]) => void };
  tabMetadata: Map<number, TabInfo>;
  tabPorts: Map<number, Map<number, chrome.runtime.Port>>;

  constructor({ logger }: { logger?: { info?: (...args: unknown[]) => void } }) {
    this.logger = logger;
    this.tabMetadata = new Map();
    this.tabPorts = new Map();
  }

  ensureTabInfo(tabId: number): TabInfo {
    if (!this.tabMetadata.has(tabId)) {
      this.tabMetadata.set(tabId, { lastVideoUrl: null, lastFrameId: null });
    }
    const existing = this.tabMetadata.get(tabId);
    if (!existing) {
      const created = { lastVideoUrl: null, lastFrameId: null };
      this.tabMetadata.set(tabId, created);
      return created;
    }
    return existing;
  }

  rememberActiveFrame(tabId: number, frameId: number, pageUrl?: string) {
    if (typeof tabId !== "number") return;
    const info = this.ensureTabInfo(tabId);
    if (typeof frameId === "number") {
      info.lastFrameId = frameId;
    }
    if (pageUrl) {
      info.lastVideoUrl = pageUrl;
    }
    this.tabMetadata.set(tabId, info);
  }

  registerPort(tabId: number, frameId: number, port: chrome.runtime.Port) {
    this.ensureTabInfo(tabId);
    const framePorts = this.tabPorts.get(tabId) || new Map();
    framePorts.set(frameId, port);
    this.tabPorts.set(tabId, framePorts);
  }

  getPort(tabId: number, preferredFrameId: number | null): chrome.runtime.Port | null {
    const framePorts = this.tabPorts.get(tabId);
    if (!framePorts) {
      return null;
    }
    if (typeof preferredFrameId === "number" && framePorts.has(preferredFrameId)) {
      return framePorts.get(preferredFrameId) ?? null;
    }
    const iterator = framePorts.values().next();
    return iterator.done ? null : iterator.value;
  }

  getPreferredFrameId(tabId: number): number | null {
    return this.tabMetadata.get(tabId)?.lastFrameId ?? null;
  }

  clearFrame(tabId: number, frameId: number): ClearFrameResult {
    const frames = this.tabPorts.get(tabId);
    const tabInfo = this.tabMetadata.get(tabId);
    let clearedPreferredFrame = false;

    if (!frames) {
      if (tabInfo && tabInfo.lastFrameId === frameId) {
        tabInfo.lastFrameId = null;
        this.tabMetadata.set(tabId, tabInfo);
        clearedPreferredFrame = true;
      }
      this.tabMetadata.delete(tabId);
      return { removedFrame: false, clearedPreferredFrame, tabRemoved: true };
    }

    const removedFrame = frames.delete(frameId);

    if (tabInfo && tabInfo.lastFrameId === frameId) {
      tabInfo.lastFrameId = null;
      this.tabMetadata.set(tabId, tabInfo);
      clearedPreferredFrame = true;
    }

    let tabRemoved = false;
    if (frames && frames.size === 0) {
      this.tabPorts.delete(tabId);
      tabRemoved = true;
    }
    if (tabRemoved) {
      this.tabMetadata.delete(tabId);
    }

    return { removedFrame, clearedPreferredFrame, tabRemoved };
  }
}
