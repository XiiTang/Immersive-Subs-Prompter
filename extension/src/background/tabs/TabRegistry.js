export class TabRegistry {
  constructor({ logger }) {
    this.logger = logger;
    this.tabMetadata = new Map();
    this.tabPorts = new Map();
  }

  ensureTabInfo(tabId) {
    if (!this.tabMetadata.has(tabId)) {
      this.tabMetadata.set(tabId, { lastVideoUrl: null, lastFrameId: null });
    } else {
      const existing = this.tabMetadata.get(tabId);
      if (!Object.prototype.hasOwnProperty.call(existing, "lastVideoUrl")) {
        existing.lastVideoUrl = null;
      }
      if (!Object.prototype.hasOwnProperty.call(existing, "lastFrameId")) {
        existing.lastFrameId = null;
      }
    }
    return this.tabMetadata.get(tabId);
  }

  rememberActiveFrame(tabId, frameId, pageUrl) {
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

  registerPort(tabId, frameId, port) {
    this.ensureTabInfo(tabId);
    const framePorts = this.tabPorts.get(tabId) || new Map();
    framePorts.set(frameId, port);
    this.tabPorts.set(tabId, framePorts);
  }

  getPort(tabId, preferredFrameId) {
    const framePorts = this.tabPorts.get(tabId);
    if (!framePorts) {
      return null;
    }
    if (typeof preferredFrameId === "number" && framePorts.has(preferredFrameId)) {
      return framePorts.get(preferredFrameId);
    }
    const iterator = framePorts.values().next();
    return iterator.done ? null : iterator.value;
  }

  getPreferredFrameId(tabId) {
    return this.tabMetadata.get(tabId)?.lastFrameId ?? null;
  }

  clearFrame(tabId, frameId) {
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
