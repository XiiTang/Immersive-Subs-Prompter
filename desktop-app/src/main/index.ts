import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage } from "electron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { SubtitleService, pickBestTrack } from "./subtitleService.js";
import { YtDlpManager } from "./ytDlpManager.js";
import { SettingsStore, DEFAULT_SETTINGS } from "./settings.js";
import {
  AppSettings,
  DesktopState,
  ExtensionMessage,
  ExtensionMessageType,
  ExtensionPayload,
  PlaybackState,
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
  selectedSubtitleId: null,
  subtitles: null
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
      console.error("[USP] Failed to update login item settings", error);
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
      console.error("[USP] Failed to update autostart entry", error);
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
        label: "显示窗口",
        click: () => showMainWindow()
      },
      { type: "separator" },
      {
        label: "退出",
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

  // 开发模式下自动打开开发者工具
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
  console.log(`[USP] ${message}`, ...rest);
}

function updateConnectionCount(delta: number) {
  state.connectionCount = Math.max(0, state.connectionCount + delta);
  if (state.connectionCount === 0) {
    state.status = "idle";
    state.activeTabId = null;
    state.subtitleTracks = [];
    state.selectedSubtitleId = null;
    state.subtitles = null;
  } else if (state.status === "idle") {
    state.status = "awaiting-video";
  }
  pushState();
}

function resolveVideoUrl(payload: ExtensionPayload): string | null {
  const src = payload.videoSrc;
  if (src && /^https?:\/\//i.test(src)) {
    return src;
  }

  if (payload.pageUrl) {
    return payload.pageUrl;
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
      state.error = null;
      state.subtitles = null;
      state.subtitleTracks = [];
      state.selectedSubtitleId = null;

      const url = resolveVideoUrl(message.payload);
      state.videoUrl = url;

      if (!url) {
        state.status = "error";
        state.error = "无法解析视频链接";
        pushState();
        return;
      }

      state.status = "loading-subtitles";
      pushState();

      const requestId = ++subtitleRequestToken;
      try {
        const result = await subtitleService.getSubtitles(url);
        if (requestId === subtitleRequestToken) {
          state.subtitleTracks = result.tracks;
          if (result.tracks.length) {
            const preferred = pickBestTrack(result.tracks);
            state.subtitles = preferred;
            state.selectedSubtitleId = preferred.id;
            state.status = "ready";
            state.error = null;
          } else {
            state.subtitles = null;
            state.selectedSubtitleId = null;
            state.status = "error";
            state.error = "未找到可用字幕";
          }
          pushState();
        }
      } catch (error) {
        if (requestId === subtitleRequestToken) {
          state.status = "error";
          state.error =
            error && typeof error === "object" && "message" in error
              ? (error as Error).message
              : "字幕下载失败";
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
        state.subtitles = null;
        state.subtitleTracks = [];
        state.selectedSubtitleId = null;
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
          console.error("[USP] Failed to handle message", error);
        });
      } catch (error) {
        console.error("[USP] Failed to process message", error);
      }
    });

    socket.on("close", () => {
      log("Extension disconnected");
      forgetSocket(socket);
      updateConnectionCount(-1);
    });

    socket.on("error", (error: Error) => {
      console.error("[USP] WebSocket error", error);
      socket.close();
    });
  });

  wss.on("error", (error: Error) => {
    console.error("[USP] WebSocket server error", error);
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

function setSubtitleTrack(trackId: string | null) {
  if (!trackId) {
    state.selectedSubtitleId = null;
    state.subtitles = null;
    pushState();
    return;
  }
  const track = state.subtitleTracks.find((t) => t.id === trackId) || null;
  state.selectedSubtitleId = track ? track.id : null;
  state.subtitles = track;
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
ipcMain.handle("usp:select-track", (_event, trackId: string | null) => {
  setSubtitleTrack(trackId);
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
