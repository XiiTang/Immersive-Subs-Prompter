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
      "dashboard",    // Dashboard port
      "storage"       // Extension storage
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
}

export { Logger };
