import { app } from "electron";
import path from "path";
import { pathToFileURL } from "url";
import { createLogger } from "../logger.js";

type ActiveWindowResult = Awaited<ReturnType<typeof import("get-windows").activeWindow>>;
type ActiveWindowProvider = () => Promise<ActiveWindowResult>;

type GameProcessMonitorOptions = {
  getBlacklist: () => string[];
  onBlocked: (matchedValue: string) => void;
  onUnblocked: () => void;
  pollIntervalMs?: number;
  getActiveWindow?: ActiveWindowProvider;
};

const DEFAULT_POLL_INTERVAL_MS = 10000;

type GetWindowsModuleSpecifierOptions = {
  isPackaged: boolean;
  platform: NodeJS.Platform;
  resourcesPath: string;
};

export function resolveGetWindowsModuleSpecifier(options: GetWindowsModuleSpecifierOptions): string {
  if (options.platform === "darwin" && options.isPackaged) {
    return pathToFileURL(
      path.join(options.resourcesPath, "app.asar.unpacked", "node_modules", "get-windows", "index.js")
    ).href;
  }
  return "get-windows";
}

async function getActiveWindow(): Promise<ActiveWindowResult> {
  const getWindows = await import(
    resolveGetWindowsModuleSpecifier({
      isPackaged: app.isPackaged,
      platform: process.platform,
      resourcesPath: process.resourcesPath
    })
  ) as typeof import("get-windows");
  return getWindows.activeWindow();
}

export class GameProcessMonitor {
  private readonly log = createLogger("desktop");
  private timer: NodeJS.Timeout | null = null;
  private isBlocked = false;

  constructor(private readonly options: GameProcessMonitorOptions) {}

  start() {
    if (this.timer) {
      return;
    }
    void this.evaluate();
    this.timer = setInterval(
      () => void this.evaluate(),
      this.options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS
    );
  }

  stop() {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = null;
  }

  refresh() {
    void this.evaluate();
  }

  private async evaluate() {
    const blacklist = this.getNormalizedBlacklist();

    if (!blacklist.size) {
      if (this.isBlocked) {
        this.isBlocked = false;
      }
      this.options.onUnblocked();
      return;
    }

    try {
      const active = await (this.options.getActiveWindow ?? getActiveWindow)();

      const appName = active?.owner?.name?.trim() || "";
      const processPath = active?.owner?.path || "";
      const processFileName = processPath ? path.basename(processPath) : "";

      const normalizedAppName = appName.toLowerCase();
      const normalizedProcessFileName = processFileName.toLowerCase();

      let matchedValue = "";
      if (normalizedAppName && blacklist.has(normalizedAppName)) {
        matchedValue = appName;
      } else if (normalizedProcessFileName && blacklist.has(normalizedProcessFileName)) {
        matchedValue = processFileName;
      }

      if (matchedValue) {
        if (!this.isBlocked) {
          this.log.info(`[GameBlacklist] Matched "${matchedValue}" - disabling shortcuts`);
        }
        this.isBlocked = true;
        this.options.onBlocked(matchedValue);
        return;
      }

      if (this.isBlocked) {
        this.isBlocked = false;
        this.log.info(
          `[GameBlacklist] Switched to "${processFileName || appName}" - enabling shortcuts`
        );
      }

      this.options.onUnblocked();
    } catch (error) {
      this.log.warn("[GameBlacklist] Failed to check active window:", error);
      if (this.isBlocked) {
        this.isBlocked = false;
      }
      this.options.onUnblocked();
    }
  }

  private getNormalizedBlacklist(): Set<string> {
    const normalized = new Set<string>();
    const list = this.options.getBlacklist() ?? [];
    for (const entry of list) {
      if (typeof entry !== "string") {
        continue;
      }
      const trimmed = entry.trim().toLowerCase();
      if (trimmed.length) {
        normalized.add(trimmed);
      }
    }
    return normalized;
  }
}
