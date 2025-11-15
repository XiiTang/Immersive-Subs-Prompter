const { contextBridge, ipcRenderer } = require("electron");
import type { AppSettings } from "./main/types.js";

type Listener<T> = (payload: T) => void;

function subscribe<T>(channel: string, listener: Listener<T>) {
  const wrapped = (_event: any, payload: T) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const api = {
  getInitialState: (): Promise<any> => ipcRenderer.invoke("usp:get-state"),
  onStateChange: (listener: Listener<any>) => subscribe("usp:state", listener),
  onPlayback: (listener: Listener<any>) => subscribe("usp:time", listener),
  onLoopCleared: (listener: Listener<void>) => subscribe("usp:loop-cleared", listener),
  selectSubtitleTrack: (trackId: string | null, role: "primary" | "secondary" = "primary") =>
    ipcRenderer.invoke("usp:select-track", { trackId, role }),
  controlVideo: (command: any) => ipcRenderer.invoke("usp:control", command),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke("usp:get-settings"),
  updateSettings: (changes: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke("usp:update-settings", changes),
  onSettingsChange: (listener: Listener<AppSettings>) => subscribe("usp:settings", listener),
  getCacheStats: (): Promise<{ totalEntries: number; totalSize: number; oldestEntry: number | null; newestEntry: number | null }> =>
    ipcRenderer.invoke("usp:cache-stats"),
  clearCache: (): Promise<{ success: boolean }> => ipcRenderer.invoke("usp:cache-clear"),
  cleanupCache: (): Promise<{ success: boolean; removedCount: number }> => ipcRenderer.invoke("usp:cache-cleanup"),
  openCacheFolder: (): Promise<void> => ipcRenderer.invoke("usp:cache-open-folder"),
  toggleDisplayFullscreen: (): Promise<boolean> => ipcRenderer.invoke("usp:toggle-display-fullscreen")
};

contextBridge.exposeInMainWorld("usp", api);

export type RendererApi = typeof api;
