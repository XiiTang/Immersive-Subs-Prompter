import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { SubtitleService, pickBestTrack } from "./subtitleService.js";
import {
  DesktopState,
  ExtensionMessage,
  ExtensionMessageType,
  ExtensionPayload,
  PlaybackState,
  VideoControlCommand
} from "./types.js";

const WS_PORT = Number(process.env.USP_WS_PORT ?? 44501);
const subtitleService = new SubtitleService();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let subtitleRequestToken = 0;
const tabSockets = new Map<number, WebSocket>();
const socketTabs = new Map<WebSocket, Set<number>>();

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

ipcMain.handle("usp:get-state", () => state);
ipcMain.handle("usp:select-track", (_event, trackId: string | null) => {
  setSubtitleTrack(trackId);
});
ipcMain.handle("usp:control", (_event, command) => {
  sendControlCommand(command);
});

app.whenReady().then(() => {
  bootstrapWebSocketServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
