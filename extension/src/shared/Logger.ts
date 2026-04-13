const LOG_PREFIX = "[USP]";
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

type LogLevelName = keyof typeof LOG_LEVELS;
type LogLevelValue = (typeof LOG_LEVELS)[LogLevelName];

class Logger {
  context: string;
  minLevel: LogLevelValue;
  enabledCategories: Set<string>;

  constructor(context: string, minLevel: LogLevelValue = LOG_LEVELS.DEBUG) {
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

  _shouldLog(level: LogLevelValue, category?: string) {
    if (level < this.minLevel) return false;
    if (category && !this.enabledCategories.has(category)) return false;
    return true;
  }

  _formatMessage(level: LogLevelValue, category: string | undefined, message: string, data?: unknown) {
    const timestamp = new Date().toISOString().split("T")[1]?.slice(0, -1) ?? "";
    const levelStr = (Object.keys(LOG_LEVELS) as LogLevelName[]).find((k) => LOG_LEVELS[k] === level) || "LOG";
    const categoryStr = category ? `[${category}]` : "";
    const contextStr = `[${this.context}]`;
    return {
      prefix: `${LOG_PREFIX} ${timestamp} ${contextStr}${categoryStr} ${levelStr}:`,
      message,
      data,
    };
  }

  _log(level: LogLevelValue, category: string, message: string, data?: unknown) {
    if (!this._shouldLog(level, category)) return;
    const formatted = this._formatMessage(level, category, message, data);
    const consoleMethod = level === LOG_LEVELS.ERROR ? "error" : level === LOG_LEVELS.WARN ? "warn" : level === LOG_LEVELS.INFO ? "info" : "log";
    if (data !== undefined) {
      (console[consoleMethod as "log" | "info" | "warn" | "error"])(formatted.prefix, formatted.message, data);
    } else {
      (console[consoleMethod as "log" | "info" | "warn" | "error"])(formatted.prefix, formatted.message);
    }
  }

  debug(category: string, message: string, data?: unknown) {
    this._log(LOG_LEVELS.DEBUG, category, message, data);
  }

  info(category: string, message: string, data?: unknown) {
    this._log(LOG_LEVELS.INFO, category, message, data);
  }

  warn(category: string, message: string, data?: unknown) {
    this._log(LOG_LEVELS.WARN, category, message, data);
  }

  error(category: string, message: string, data?: unknown) {
    this._log(LOG_LEVELS.ERROR, category, message, data);
  }

  videoDetected(video: HTMLVideoElement, details?: Record<string, unknown>) {
    this.info("video-detection", "Video element detected", {
      src: video.currentSrc || video.src || "(no src)",
      readyState: video.readyState,
      duration: video.duration,
      paused: video.paused,
      ...details,
    });
  }

  videoActivated(video: HTMLVideoElement, reason: string) {
    this.info("video-detection", `Video activated: ${reason}`, {
      src: video.currentSrc || video.src,
      currentTime: video.currentTime,
      duration: video.duration,
    });
  }

  videoStateChange(eventType: string, state: unknown) {
    this.debug("media-state", `Video state changed: ${eventType}`, state);
  }

  messageSent(type: string, payload: unknown, target: string) {
    this.debug("message-transmission", `Message sent: ${type} -> ${target}`, payload);
  }

  messageReceived(type: string, payload: unknown, source: string) {
    this.debug("message-transmission", `Message received: ${type} <- ${source}`, payload);
  }

  messageDeliveryFailed(type: string, error: unknown, target: string) {
    this.error("message-transmission", `Message delivery failed: ${type} -> ${target}`, error);
  }

  desktopConnected() {
    this.info("desktop-communication", "Connected to desktop-app");
  }

  desktopDisconnected() {
    this.warn("desktop-communication", "desktop-app connection closed");
  }

  desktopMessageSent(data: { type?: string; tabId?: number; payload?: unknown }) {
    this.debug("desktop-communication", "Sending data to desktop-app", {
      type: data.type,
      tabId: data.tabId,
      payloadKeys: data.payload ? Object.keys(data.payload) : [],
    });
  }

  desktopMessageReceived(data: { type?: string; source?: string }) {
    this.debug("desktop-communication", "Receiving data from desktop-app", {
      type: data.type,
      source: data.source,
    });
  }

  portConnected(portName: string, details?: unknown) {
    this.info("connection", `Port connected: ${portName}`, details);
  }

  portDisconnected(portName: string, details?: unknown) {
    this.info("connection", `Port disconnected: ${portName}`, details);
  }

  reconnecting(target: string, delay: number) {
    this.info("connection", `Reconnecting: ${target}`, { delayMs: delay });
  }

  controlCommandReceived(action: string, payload: unknown) {
    this.info("control", `Control command received: ${action}`, payload);
  }

  controlCommandExecuted(action: string, success: boolean, details?: unknown) {
    if (success) {
      this.info("control", `Control command executed successfully: ${action}`, details);
    } else {
      this.warn("control", `Control command execution failed: ${action}`, details);
    }
  }

  mediaFiltered(reason: string, payload?: { duration?: unknown; readyState?: unknown }) {
    this.debug("media-state", `Media filtered: ${reason}`, {
      duration: payload?.duration,
      readyState: payload?.readyState,
    });
  }

  mediaStateUpdated(tabId: number, eventType: string, isValid: boolean) {
    this.debug("media-state", `Media state updated: Tab ${tabId}, Event: ${eventType}, Valid: ${isValid}`);
  }

  logError(category: string, message: string, error: unknown) {
    const normalized = error instanceof Error ? error : new Error(String(error));
    this.error(category, message, {
      error: normalized.message,
      stack: normalized.stack,
    });
  }

  enableCategory(category: string) {
    this.enabledCategories.add(category);
  }

  disableCategory(category: string) {
    this.enabledCategories.delete(category);
  }

  setLevel(level: string | LogLevelValue) {
    if (typeof level === "string") {
      this.minLevel = LOG_LEVELS[level.toUpperCase() as LogLevelName] || LOG_LEVELS.DEBUG;
    } else {
      this.minLevel = level;
    }
  }
}

export { Logger, LOG_LEVELS };
