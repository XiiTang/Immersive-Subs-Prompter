import { BrowserWindow, screen } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import type { AppSettings } from "../types.js";
import type {
  WordLookupMatch,
  WordLookupPanelSize
} from "../plugins/official/wordLookup/wordLookupTypes.js";
import { WORD_LOOKUP_PANEL_SIZE_LIMITS } from "../plugins/official/wordLookup/defaults.js";

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type WorkArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Size = {
  width: number;
  height: number;
};

export type WordLookupWindowOpenPayload = {
  anchorRect: Rect;
  panelSize: WordLookupPanelSize;
  matches: WordLookupMatch[];
};

export type WordLookupWindowPayload = {
  matches: WordLookupMatch[];
};

export type WordLookupWindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  placement: "lower-right" | "lower-left";
};

type Logger = {
  error: (message: string, error?: unknown) => void;
  warn: (message: string, extra?: unknown) => void;
  info: (message: string, extra?: unknown) => void;
  debug: (message: string, extra?: unknown) => void;
};

type WordLookupWindowManagerOptions = {
  getMainWindow: () => BrowserWindow | null;
  getSettings: () => AppSettings;
  updateWordLookupPanelSize: (size: WordLookupPanelSize) => void;
  getRendererHtmlPath?: () => string;
  getPreloadPath?: () => string;
  createWindow?: (options: Electron.BrowserWindowConstructorOptions) => BrowserWindow;
  getDisplayWorkArea?: (point: Electron.Point) => WorkArea;
  logger: Logger;
};

const DEFAULT_GAP = 8;
const DEFAULT_MARGIN = 12;
const HANDOFF_CLOSE_DELAY_MS = 200;

function isFiniteRect(rect: Rect) {
  return [
    rect.left,
    rect.top,
    rect.right,
    rect.bottom,
    rect.width,
    rect.height
  ].every(Number.isFinite);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function computeWordLookupWindowBounds(input: {
  anchorRect: Rect;
  panelSize: Size;
  workArea: WorkArea;
  gap?: number;
  margin?: number;
  minSize?: Size;
}): WordLookupWindowBounds {
  const gap = input.gap ?? DEFAULT_GAP;
  const margin = input.margin ?? DEFAULT_MARGIN;
  const minSize = input.minSize ?? {
    width: WORD_LOOKUP_PANEL_SIZE_LIMITS.minWidth,
    height: WORD_LOOKUP_PANEL_SIZE_LIMITS.minHeight
  };
  const maxWidth = Math.max(minSize.width, input.workArea.width - margin * 2);
  const maxHeight = Math.max(minSize.height, input.workArea.height - margin * 2);
  const width = clamp(Math.round(input.panelSize.width), minSize.width, maxWidth);
  const height = clamp(Math.round(input.panelSize.height), minSize.height, maxHeight);
  const rightCandidate = {
    x: input.anchorRect.right + gap,
    y: input.anchorRect.bottom + gap
  };
  const overflowsRight = rightCandidate.x + width > input.workArea.x + input.workArea.width - margin;
  const placement = overflowsRight ? "lower-left" : "lower-right";
  const candidateX = placement === "lower-left"
    ? input.anchorRect.left - width - gap
    : rightCandidate.x;
  const minX = input.workArea.x + margin;
  const maxX = input.workArea.x + input.workArea.width - width - margin;
  const minY = input.workArea.y + margin;
  const maxY = input.workArea.y + input.workArea.height - height - margin;

  return {
    x: Math.round(clamp(candidateX, minX, Math.max(minX, maxX))),
    y: Math.round(clamp(rightCandidate.y, minY, Math.max(minY, maxY))),
    width,
    height,
    placement
  };
}

export class WordLookupWindowManager {
  private lookupWindow: BrowserWindow | null = null;
  private handoffCloseTimer: NodeJS.Timeout | null = null;
  private pointerInsideWindow = false;
  private observedMainWindow: BrowserWindow | null = null;
  private readonly __dirname = path.dirname(fileURLToPath(import.meta.url));

  constructor(private readonly options: WordLookupWindowManagerOptions) {}

  async open(payload: WordLookupWindowOpenPayload): Promise<{ success: boolean; error?: string }> {
    if (!this.isValidPayload(payload)) {
      return { success: false, error: "Invalid word lookup window payload" };
    }

    const mainWindow = this.options.getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible() || mainWindow.isMinimized()) {
      return { success: false, error: "Subtitle window unavailable" };
    }

    this.close();
    this.pointerInsideWindow = false;
    this.bindMainWindow(mainWindow);

    const mainBounds = mainWindow.getBounds();
    const screenAnchor = {
      left: mainBounds.x + payload.anchorRect.left,
      top: mainBounds.y + payload.anchorRect.top,
      right: mainBounds.x + payload.anchorRect.right,
      bottom: mainBounds.y + payload.anchorRect.bottom,
      width: payload.anchorRect.width,
      height: payload.anchorRect.height
    };
    const workArea = this.resolveWorkArea({ x: screenAnchor.left, y: screenAnchor.bottom });
    const bounds = computeWordLookupWindowBounds({
      anchorRect: screenAnchor,
      panelSize: payload.panelSize,
      workArea
    });

    const lookupWindow = this.options.createWindow?.(this.getWindowOptions(mainWindow, bounds))
      ?? new BrowserWindow(this.getWindowOptions(mainWindow, bounds));
    this.lookupWindow = lookupWindow;
    this.applyAlwaysOnTop();
    lookupWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    });
    lookupWindow.on("closed", () => {
      if (this.lookupWindow === lookupWindow) {
        this.lookupWindow = null;
      }
      this.clearHandoffTimer();
    });
    lookupWindow.webContents.once("render-process-gone", (_event, details) => {
      this.options.logger.error("Word lookup window renderer exited", details);
      this.close();
    });

    try {
      await lookupWindow.loadFile(this.getRendererHtmlPath());
      lookupWindow.webContents.send("word-lookup-window:payload", { matches: payload.matches });
      lookupWindow.showInactive();
      return { success: true };
    } catch (error) {
      this.options.logger.error("Failed to load word lookup window", error);
      this.close();
      return { success: false, error: "Failed to load word lookup window" };
    }
  }

  handlePointerEnter() {
    this.pointerInsideWindow = true;
    this.clearHandoffTimer();
  }

  handlePointerLeave() {
    this.close();
  }

  handleTriggerLeave() {
    if (!this.lookupWindow || this.pointerInsideWindow) {
      return;
    }
    this.clearHandoffTimer();
    this.handoffCloseTimer = setTimeout(() => {
      if (!this.pointerInsideWindow) {
        this.close();
      }
    }, HANDOFF_CLOSE_DELAY_MS);
  }

  handleResize(size: WordLookupPanelSize) {
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height)) {
      return;
    }
    if (!this.lookupWindow || this.lookupWindow.isDestroyed()) {
      return;
    }

    const bounds = this.lookupWindow.getBounds();
    const workArea = this.resolveWorkArea({
      x: bounds.x + bounds.width,
      y: bounds.y + bounds.height
    });
    const maxWidth = Math.min(
      WORD_LOOKUP_PANEL_SIZE_LIMITS.maxWidth,
      Math.max(WORD_LOOKUP_PANEL_SIZE_LIMITS.minWidth, workArea.x + workArea.width - DEFAULT_MARGIN - bounds.x)
    );
    const maxHeight = Math.min(
      WORD_LOOKUP_PANEL_SIZE_LIMITS.maxHeight,
      Math.max(WORD_LOOKUP_PANEL_SIZE_LIMITS.minHeight, workArea.y + workArea.height - DEFAULT_MARGIN - bounds.y)
    );
    const panelSize = {
      width: clamp(Math.round(size.width), WORD_LOOKUP_PANEL_SIZE_LIMITS.minWidth, maxWidth),
      height: clamp(Math.round(size.height), WORD_LOOKUP_PANEL_SIZE_LIMITS.minHeight, maxHeight)
    };

    this.lookupWindow.setBounds(panelSize);
    this.options.updateWordLookupPanelSize(panelSize);
  }

  updateAlwaysOnTop() {
    this.applyAlwaysOnTop();
  }

  close() {
    this.clearHandoffTimer();
    this.pointerInsideWindow = false;
    const window = this.lookupWindow;
    this.lookupWindow = null;
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }

  private isValidPayload(payload: WordLookupWindowOpenPayload) {
    return (
      !!payload &&
      isFiniteRect(payload.anchorRect) &&
      Number.isFinite(payload.panelSize.width) &&
      Number.isFinite(payload.panelSize.height) &&
      Array.isArray(payload.matches) &&
      payload.matches.length > 0
    );
  }

  private getWindowOptions(
    mainWindow: BrowserWindow,
    bounds: Pick<WordLookupWindowBounds, "x" | "y" | "width" | "height">
  ): Electron.BrowserWindowConstructorOptions {
    return {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      minWidth: WORD_LOOKUP_PANEL_SIZE_LIMITS.minWidth,
      minHeight: WORD_LOOKUP_PANEL_SIZE_LIMITS.minHeight,
      frame: false,
      hasShadow: false,
      transparent: true,
      backgroundColor: "#00000000",
      resizable: true,
      fullscreenable: false,
      skipTaskbar: true,
      show: false,
      parent: mainWindow,
      titleBarStyle: "hidden",
      webPreferences: {
        preload: this.getPreloadPath(),
        contextIsolation: true,
        nodeIntegration: false
      }
    };
  }

  private resolveWorkArea(point: Electron.Point): WorkArea {
    return this.options.getDisplayWorkArea?.(point) ?? screen.getDisplayNearestPoint(point).workArea;
  }

  private applyAlwaysOnTop() {
    if (!this.lookupWindow || this.lookupWindow.isDestroyed()) {
      return;
    }
    const level = this.options.getSettings().global.alwaysOnTop;
    if (level === "off") {
      this.lookupWindow.setAlwaysOnTop(false);
      return;
    }
    this.lookupWindow.setAlwaysOnTop(true, level);
  }

  private bindMainWindow(mainWindow: BrowserWindow) {
    if (this.observedMainWindow === mainWindow) {
      return;
    }
    this.unbindMainWindow();
    this.observedMainWindow = mainWindow;
    mainWindow.on("hide", this.closeForMainWindow);
    mainWindow.on("minimize", this.closeForMainWindow);
    mainWindow.on("closed", this.closeForMainWindow);
  }

  private unbindMainWindow() {
    if (!this.observedMainWindow || this.observedMainWindow.isDestroyed()) {
      this.observedMainWindow = null;
      return;
    }
    this.observedMainWindow.off("hide", this.closeForMainWindow);
    this.observedMainWindow.off("minimize", this.closeForMainWindow);
    this.observedMainWindow.off("closed", this.closeForMainWindow);
    this.observedMainWindow = null;
  }

  private readonly closeForMainWindow = () => {
    this.close();
  };

  private clearHandoffTimer() {
    if (this.handoffCloseTimer) {
      clearTimeout(this.handoffCloseTimer);
      this.handoffCloseTimer = null;
    }
  }

  private getRendererHtmlPath() {
    return this.options.getRendererHtmlPath?.() ?? path.join(this.__dirname, "../../renderer/word-lookup-window.html");
  }

  private getPreloadPath() {
    return this.options.getPreloadPath?.() ?? path.join(this.__dirname, "../../preload.cjs");
  }
}
