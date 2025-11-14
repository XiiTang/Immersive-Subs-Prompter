const LOG_PREFIX = "[USP]";
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor(context, minLevel = LOG_LEVELS.DEBUG) {
    this.context = context;
    this.minLevel = minLevel;
    this.enabledCategories = new Set([
      "ws",           // WebSocket communication
      "msg",          // Message passing
      "conn",         // Connection management
      "ctrl",         // Control commands
      "video",        // Video detection/state
      "media",        // Media state updates
      "loop",         // Loop control
      "page",         // Page navigation
      "fwd",          // Message forwarding
      "blacklist",    // Blacklist filtering
      "site",         // Site detection
      "event",        // DOM events
      "shadow",       // Shadow DOM
      "drift",        // Playback drift
      "filter",       // Media filtering
      "dashboard"     // Dashboard port
    ]);
  }

  _shouldLog(level, category) {
    if (level < this.minLevel) return false;
    if (category && !this.enabledCategories.has(category)) return false;
    return true;
  }

  _formatMessage(level, category, message, data) {
    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);
    const levelStr = Object.keys(LOG_LEVELS).find((k) => LOG_LEVELS[k] === level) || "LOG";
    const categoryStr = category ? `[${category}]` : "";
    const contextStr = `[${this.context}]`;
    return {
      prefix: `${LOG_PREFIX} ${timestamp} ${contextStr}${categoryStr} ${levelStr}:`,
      message,
      data,
    };
  }

  _log(level, category, message, data) {
    if (!this._shouldLog(level, category)) return;
    const formatted = this._formatMessage(level, category, message, data);
    const consoleMethod = level === LOG_LEVELS.ERROR ? "error" : level === LOG_LEVELS.WARN ? "warn" : level === LOG_LEVELS.INFO ? "info" : "log";
    if (data !== undefined) {
      console[consoleMethod](formatted.prefix, formatted.message, data);
    } else {
      console[consoleMethod](formatted.prefix, formatted.message);
    }
  }

  debug(category, message, data) {
    this._log(LOG_LEVELS.DEBUG, category, message, data);
  }

  info(category, message, data) {
    this._log(LOG_LEVELS.INFO, category, message, data);
  }

  warn(category, message, data) {
    this._log(LOG_LEVELS.WARN, category, message, data);
  }

  error(category, message, data) {
    this._log(LOG_LEVELS.ERROR, category, message, data);
  }

  videoDetected(video, details) {
    this.info("video-detection", "Video element detected", {
      src: video.currentSrc || video.src || "(no src)",
      readyState: video.readyState,
      duration: video.duration,
      paused: video.paused,
      ...details,
    });
  }

  videoActivated(video, reason) {
    this.info("video-detection", `Video activated: ${reason}`, {
      src: video.currentSrc || video.src,
      currentTime: video.currentTime,
      duration: video.duration,
    });
  }

  videoStateChange(eventType, state) {
    this.debug("media-state", `Video state changed: ${eventType}`, state);
  }

  messageSent(type, payload, target) {
    this.debug("message-transmission", `Message sent: ${type} -> ${target}`, payload);
  }

  messageReceived(type, payload, source) {
    this.debug("message-transmission", `Message received: ${type} <- ${source}`, payload);
  }

  messageDeliveryFailed(type, error, target) {
    this.error("message-transmission", `Message delivery failed: ${type} -> ${target}`, error);
  }

  desktopConnected() {
    this.info("desktop-communication", "Connected to desktop-app");
  }

  desktopDisconnected() {
    this.warn("desktop-communication", "desktop-app connection closed");
  }

  desktopMessageSent(data) {
    this.debug("desktop-communication", "Sending data to desktop-app", {
      type: data.type,
      tabId: data.tabId,
      payloadKeys: data.payload ? Object.keys(data.payload) : [],
    });
  }

  desktopMessageReceived(data) {
    this.debug("desktop-communication", "Receiving data from desktop-app", {
      type: data.type,
      source: data.source,
    });
  }

  portConnected(portName, details) {
    this.info("connection", `Port connected: ${portName}`, details);
  }

  portDisconnected(portName, details) {
    this.info("connection", `Port disconnected: ${portName}`, details);
  }

  reconnecting(target, delay) {
    this.info("connection", `Reconnecting: ${target}`, { delayMs: delay });
  }

  controlCommandReceived(action, payload) {
    this.info("control", `Control command received: ${action}`, payload);
  }

  controlCommandExecuted(action, success, details) {
    if (success) {
      this.info("control", `Control command executed successfully: ${action}`, details);
    } else {
      this.warn("control", `Control command execution failed: ${action}`, details);
    }
  }

  mediaFiltered(reason, payload) {
    this.debug("media-state", `Media filtered: ${reason}`, {
      duration: payload?.duration,
      readyState: payload?.readyState,
    });
  }

  mediaStateUpdated(tabId, eventType, isValid) {
    this.debug("media-state", `Media state updated: Tab ${tabId}, Event: ${eventType}, Valid: ${isValid}`);
  }

  logError(category, message, error) {
    this.error(category, message, {
      error: error.message || error,
      stack: error.stack,
    });
  }

  enableCategory(category) {
    this.enabledCategories.add(category);
  }

  disableCategory(category) {
    this.enabledCategories.delete(category);
  }

  setLevel(level) {
    if (typeof level === "string") {
      this.minLevel = LOG_LEVELS[level.toUpperCase()] || LOG_LEVELS.DEBUG;
    } else {
      this.minLevel = level;
    }
  }
}

export { Logger, LOG_LEVELS };

