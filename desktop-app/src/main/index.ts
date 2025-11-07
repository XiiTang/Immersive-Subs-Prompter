import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { SubtitleService, pickBestTrack } from "./subtitleService.js";
import { YtDlpManager } from "./ytDlpManager.js";
import { SettingsStore, DEFAULT_SETTINGS } from "./settings.js";
import { createLogger } from "./logger.js";
import {
  AppSettings,
  DesktopState,
  ExtensionMessage,
  ExtensionMessageType,
  ExtensionPayload,
  PlaybackState,
  SubtitleTrack,
  VideoControlCommand
} from "./types.js";

const WS_PORT = Number(process.env.USP_WS_PORT ?? 44501);
const ytDlpManager = new YtDlpManager();
let appSettings: AppSettings = DEFAULT_SETTINGS;
const subtitleService = new SubtitleService(() => ytDlpManager.getBinaryPath(), () => appSettings);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRAY_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAAHklEQVR4nGOw2PvjPzUxw6iBowaOGjhq4KiBI9VAAN3kkP39BLd4AAAAAElFTkSuQmCC";

let mainWindow: BrowserWindow | null = null;
let subtitleRequestToken = 0;
const tabSockets = new Map<number, WebSocket>();
const socketTabs = new Map<WebSocket, Set<number>>();
let tray: Tray | null = null;
let isQuitting = false;
let settingsStore: SettingsStore | null = null;
const mainLogger = createLogger("desktop");

const state: DesktopState = {
  connectionCount: 0,
  activeTabId: null,
  pageUrl: null,
  videoUrl: null,
  title: null,
  site: null,
  status: "idle",
  error: null,
  playback: {
    currentTime: 0,
    playbackRate: 1,
    lastUpdate: null
  },
  subtitleTracks: [],
  selectedPrimarySubtitleId: null,
  selectedSecondarySubtitleId: null,
  primarySubtitles: null,
  secondarySubtitles: null
};

function getAutostartDesktopEntryPath() {
  const configDir = path.join(app.getPath("home"), ".config", "autostart");
  return path.join(configDir, "universal-subtitle.desktop");
}

function applyAutoLaunch(enabled: boolean) {
  if (process.platform === "win32" || process.platform === "darwin") {
    try {
      app.setLoginItemSettings({
        openAtLogin: enabled,
        path: process.execPath
      });
    } catch (error) {
      mainLogger.error("Failed to update login item settings", error);
    }
    return;
  }

  if (process.platform === "linux") {
    const desktopFile = getAutostartDesktopEntryPath();
    try {
      if (enabled) {
        fs.mkdirSync(path.dirname(desktopFile), { recursive: true });
        const execPath = process.execPath;
        const entry = [
          "[Desktop Entry]",
          "Type=Application",
          "Version=1.0",
          "Name=Universal Subtitle",
          `Exec="${execPath}"`,
          "Terminal=false",
          "X-GNOME-Autostart-enabled=true"
        ].join("\n");
        fs.writeFileSync(desktopFile, `${entry}\n`, "utf-8");
      } else if (fs.existsSync(desktopFile)) {
        fs.rmSync(desktopFile);
      }
    } catch (error) {
      mainLogger.error("Failed to update autostart entry", error);
    }
  }
}

function ensureTray() {
  if (tray) {
    return;
  }
  const icon = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  tray = new Tray(icon);
  tray.setToolTip("Universal Subtitle");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Show Window",
        click: () => showMainWindow()
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          isQuitting = true;
          tray?.destroy();
          tray = null;
          app.quit();
        }
      }
    ])
  );
  tray.on("click", () => {
    showMainWindow();
  });
}

function showMainWindow() {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
    return;
  }
  createWindow();
}

function pushSettings() {
  if (!mainWindow) return;
  mainWindow.webContents.send("usp:settings", appSettings);
}

function updateAppSettings(partial: Partial<AppSettings>) {
  if (!settingsStore) {
    return appSettings;
  }
  const previous = appSettings;
  appSettings = settingsStore.update(partial);
  if (previous.autoLaunch !== appSettings.autoLaunch) {
    applyAutoLaunch(appSettings.autoLaunch);
  }
  if (previous.closeBehavior !== appSettings.closeBehavior && mainWindow) {
    if (appSettings.closeBehavior === "quit") {
      mainWindow.setSkipTaskbar(false);
    } else if (!mainWindow.isVisible()) {
      mainWindow.setSkipTaskbar(true);
    }
  }
  const primaryPriorityChanged = !areStringArraysEqual(
    previous.primarySubtitlePriority,
    appSettings.primarySubtitlePriority
  );
  const secondaryPriorityChanged = !areStringArraysEqual(
    previous.secondarySubtitlePriority,
    appSettings.secondarySubtitlePriority
  );

  const shouldReapplyPriorities = (primaryPriorityChanged || secondaryPriorityChanged) && state.subtitleTracks.length > 0;

  if (shouldReapplyPriorities) {
    applyPreferredTracksFromSettings(state.subtitleTracks);
    pushState();
  }

  pushSettings();
  return appSettings;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 460,
    height: 640,
    frame: false,
    transparent: false,
    resizable: true,
    fullscreenable: false,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(false);
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  mainWindow.on("close", (event) => {
    if (!isQuitting && appSettings.closeBehavior === "tray") {
      event.preventDefault();
      mainWindow?.hide();
      mainWindow?.setSkipTaskbar(true);
    }
  });

  mainWindow.on("show", () => {
    mainWindow?.setSkipTaskbar(false);
  });

  mainWindow.on("hide", () => {
    if (appSettings.closeBehavior === "tray") {
      mainWindow?.setSkipTaskbar(true);
    }
  });

  // Auto-open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.once("did-finish-load", () => {
    pushSettings();
    pushState();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function pushState() {
  if (!mainWindow) return;
  mainWindow.webContents.send("usp:state", state);
}

function sendPlaybackUpdate(playback: PlaybackState) {
  if (!mainWindow) return;
  mainWindow.webContents.send("usp:time", playback);
}

function log(message: string, ...rest: unknown[]) {
  mainLogger.info(message, ...rest);
}

function updateConnectionCount(delta: number) {
  state.connectionCount = Math.max(0, state.connectionCount + delta);
  if (state.connectionCount === 0) {
    state.status = "idle";
    state.activeTabId = null;
    state.subtitleTracks = [];
    state.selectedPrimarySubtitleId = null;
    state.selectedSecondarySubtitleId = null;
    state.primarySubtitles = null;
    state.secondarySubtitles = null;
  } else if (state.status === "idle") {
    state.status = "awaiting-video";
  }
  pushState();
}

const PAGE_URL_SITES = new Set(["youtube", "bilibili", "douyin"]);

function createTrackSignature(track: SubtitleTrack): string {
  return `${track.language}|${track.label}|${track.sourceFile}`.toLowerCase();
}

function normalizePriorityEntries(entries: string[]): string[] {
  return entries.map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0);
}

function pickTrackByPriority(
  tracks: SubtitleTrack[],
  priorities: string[],
  excludeIds: Set<string> = new Set()
): SubtitleTrack | null {
  if (!tracks.length || !priorities.length) {
    return null;
  }
  const normalized = normalizePriorityEntries(priorities);
  if (!normalized.length) {
    return null;
  }
  for (const priority of normalized) {
    const matched = tracks.find((track) => {
      if (excludeIds.has(track.id)) {
        return false;
      }
      return createTrackSignature(track).includes(priority);
    });
    if (matched) {
      return matched;
    }
  }
  return null;
}

function applyPreferredTracksFromSettings(tracks: SubtitleTrack[]) {
  if (!tracks.length) {
    state.primarySubtitles = null;
    state.secondarySubtitles = null;
    state.selectedPrimarySubtitleId = null;
    state.selectedSecondarySubtitleId = null;
    return;
  }

  let primary = pickTrackByPriority(tracks, appSettings.primarySubtitlePriority);
  if (!primary) {
    primary = pickBestTrack(tracks);
  }

  state.primarySubtitles = primary ?? null;
  state.selectedPrimarySubtitleId = primary?.id ?? null;

  const exclude = new Set<string>();
  if (primary) {
    exclude.add(primary.id);
  }

  const secondary = pickTrackByPriority(tracks, appSettings.secondarySubtitlePriority, exclude);
  state.secondarySubtitles = secondary ?? null;
  state.selectedSecondarySubtitleId = secondary?.id ?? null;
}

function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a === b) {
    return true;
  }
  if (a.length !== b.length) {
    return false;
  }
  return a.every((value, index) => value === b[index]);
}

function resolveVideoUrl(payload: ExtensionPayload): string | null {
  const pageUrl = typeof payload.pageUrl === "string" ? payload.pageUrl : null;
  const videoSrc = typeof payload.videoSrc === "string" ? payload.videoSrc : null;
  const site = payload.site;

  if (pageUrl && /^https?:\/\//i.test(pageUrl) && site && PAGE_URL_SITES.has(site)) {
    return pageUrl;
  }

  if (videoSrc && /^https?:\/\//i.test(videoSrc)) {
    return videoSrc;
  }

  if (pageUrl && /^https?:\/\//i.test(pageUrl)) {
    return pageUrl;
  }

  return null;
}

async function handleMessage(message: ExtensionMessage) {
  switch (message.type) {
    case "video-context": {
      state.activeTabId = message.tabId;
      state.pageUrl = message.payload.pageUrl ?? null;
      state.site = message.payload.site ?? null;
      state.title = message.payload.title ?? null;

      const url = resolveVideoUrl(message.payload);
      const previousVideoUrl = state.videoUrl;
      state.videoUrl = url;

      if (!url) {
        state.status = "error";
        state.error = "Unable to parse video URL";
        pushState();
        return;
      }

      // If video URL hasn't changed, it's the same video (e.g., just seeking), no need to reload subtitles
      // Don't retry even if previous download failed, to avoid repeated attempts
      if (url === previousVideoUrl && (state.subtitleTracks.length > 0 || state.status === "error")) {
        // Only update page info, keep subtitle or error state unchanged
        pushState();
        return;
      }

      // URL changed, need to reload subtitles
      state.error = null;
      state.primarySubtitles = null;
      state.secondarySubtitles = null;
      state.subtitleTracks = [];
      state.selectedPrimarySubtitleId = null;
      state.selectedSecondarySubtitleId = null;
      state.status = "loading-subtitles";
      pushState();

      const requestId = ++subtitleRequestToken;
      try {
        const result = await subtitleService.getSubtitles(url);
        if (requestId === subtitleRequestToken) {
          state.subtitleTracks = result.tracks;
          if (result.tracks.length) {
            applyPreferredTracksFromSettings(result.tracks);
            state.status = "ready";
            state.error = null;
          } else {
            state.primarySubtitles = null;
            state.secondarySubtitles = null;
            state.selectedPrimarySubtitleId = null;
            state.selectedSecondarySubtitleId = null;
            state.status = "error";
            state.error = "No available subtitles found";
          }
          pushState();
        }
      } catch (error) {
        if (requestId === subtitleRequestToken) {
          state.status = "error";
          state.error =
            error && typeof error === "object" && "message" in error
              ? (error as Error).message
              : "Subtitle download failed";
          state.primarySubtitles = null;
          state.secondarySubtitles = null;
          state.selectedPrimarySubtitleId = null;
          state.selectedSecondarySubtitleId = null;
          pushState();
        }
      }
      break;
    }

    case "time-update":
    case "playback-rate": {
      if (state.activeTabId !== null && state.activeTabId !== message.tabId) {
        return;
      }

      const currentTime = message.payload.currentTime ?? state.playback.currentTime;
      const playbackRate = message.payload.playbackRate ?? state.playback.playbackRate;

      state.playback = {
        currentTime,
        playbackRate,
        lastUpdate: Date.now()
      };
      sendPlaybackUpdate(state.playback);
      break;
    }

    case "video-ended": {
      if (state.activeTabId === message.tabId) {
        state.status = state.connectionCount > 0 ? "awaiting-video" : "idle";
        state.primarySubtitles = null;
        state.secondarySubtitles = null;
        state.subtitleTracks = [];
        state.selectedPrimarySubtitleId = null;
        state.selectedSecondarySubtitleId = null;
        state.videoUrl = null;
        pushState();
      }
      break;
    }

    case "page-url-changed": {
      if (state.activeTabId === message.tabId) {
        state.pageUrl = message.payload.pageUrl ?? state.pageUrl;
        state.title = message.payload.title ?? state.title;
        pushState();
      }
      break;
    }

    default:
      break;
  }
}

function bootstrapWebSocketServer() {
  const wss = new WebSocketServer({ port: WS_PORT });
  log(`WebSocket server listening on ws://127.0.0.1:${WS_PORT}`);

  wss.on("connection", (socket: WebSocket) => {
    log("Extension connected");
    updateConnectionCount(+1);

    socket.on("message", (raw: Buffer) => {
      try {
        const data = JSON.parse(raw.toString());
        if (!data || typeof data !== "object") return;
        if (data.source !== "usp-extension") return;
        const { tabId, type, payload } = data as {
          tabId: number;
          type: ExtensionMessageType;
          payload: ExtensionPayload;
        };
        rememberTabSocket(tabId, socket);
        handleMessage({ tabId, type, payload }).catch((error) => {
          mainLogger.error("Failed to handle message", error);
        });
      } catch (error) {
        mainLogger.error("Failed to process message", error);
      }
    });

    socket.on("close", () => {
      log("Extension disconnected");
      forgetSocket(socket);
      updateConnectionCount(-1);
    });

    socket.on("error", (error: Error) => {
      mainLogger.error("WebSocket error", error);
      socket.close();
    });
  });

  wss.on("error", (error: Error) => {
    mainLogger.error("WebSocket server error", error);
  });
}

function rememberTabSocket(tabId: number, socket: WebSocket) {
  tabSockets.set(tabId, socket);
  let tabs = socketTabs.get(socket);
  if (!tabs) {
    tabs = new Set();
    socketTabs.set(socket, tabs);
  }
  tabs.add(tabId);
}

function forgetSocket(socket: WebSocket) {
  const tabs = socketTabs.get(socket);
  if (!tabs) return;
  tabs.forEach((tabId) => tabSockets.delete(tabId));
  socketTabs.delete(socket);
}

type TrackSelectionPayload = {
  trackId: string | null;
  role?: "primary" | "secondary";
};

function isTrackSelectionPayload(value: unknown): value is TrackSelectionPayload {
  return Boolean(
    value &&
      typeof value === "object" &&
      "trackId" in value
  );
}

function setSubtitleTrack(trackId: string | null, role: "primary" | "secondary" = "primary") {
  const track = trackId ? state.subtitleTracks.find((t) => t.id === trackId) || null : null;
  if (role === "primary") {
    state.selectedPrimarySubtitleId = track ? track.id : null;
    state.primarySubtitles = track;
  } else {
    state.selectedSecondarySubtitleId = track ? track.id : null;
    state.secondarySubtitles = track;
  }
  pushState();
}

function sendControlCommand(command: VideoControlCommand): boolean {
  if (state.activeTabId === null) {
    return false;
  }
  const socket = tabSockets.get(state.activeTabId);
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  let payload: Record<string, unknown> | undefined;
  if (command.type === "seek") {
    payload = { time: command.time };
  }

  socket.send(
    JSON.stringify({
      source: "usp-desktop",
      type: "control-command",
      tabId: state.activeTabId,
      action: command.type,
      payload
    })
  );
  return true;
}

ipcMain.handle("usp:get-state", () => {
  return state;
});
ipcMain.handle("usp:select-track", (_event, payload: TrackSelectionPayload | string | null) => {
  if (isTrackSelectionPayload(payload)) {
    const role = payload.role === "secondary" ? "secondary" : "primary";
    setSubtitleTrack(payload.trackId ?? null, role);
  } else {
    setSubtitleTrack((payload as string | null) ?? null, "primary");
  }
});
ipcMain.handle("usp:control", (_event, command) => {
  sendControlCommand(command);
});
ipcMain.handle("usp:get-settings", () => appSettings);
ipcMain.handle("usp:update-settings", (_event, payload: Partial<AppSettings>) => {
  return updateAppSettings(payload);
});

app.whenReady().then(() => {
  settingsStore = new SettingsStore();
  appSettings = settingsStore.get();
  applyAutoLaunch(appSettings.autoLaunch);
  ensureTray();
  bootstrapWebSocketServer();
  createWindow();

  app.on("activate", () => {
    showMainWindow();
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
