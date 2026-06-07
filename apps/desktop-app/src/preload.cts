const { contextBridge, ipcRenderer } = require("electron");
import type { AppSettings } from "./main/types.js" with { "resolution-mode": "import" };
import type { CacheStats } from "./main/subtitleCacheManager.js" with { "resolution-mode": "import" };
import type { PluginManifest } from "./main/plugins/pluginManifest.js" with { "resolution-mode": "import" };

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
  onPluginCatalogChange: (listener: Listener<any[]>) => subscribe("usp:plugin-catalog", listener),
  openPath: (targetPath: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:open-path", targetPath),
  openExternal: (url: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("usp:open-external", url),
  getCacheStats: (): Promise<CacheStats> =>
    ipcRenderer.invoke("usp:cache-stats"),
  openCacheFolder: (): Promise<void> => ipcRenderer.invoke("usp:cache-open-folder"),
  toggleDisplayFullscreen: (): Promise<boolean> => ipcRenderer.invoke("usp:toggle-display-fullscreen"),
  getWindowPointerState: (): Promise<{ insideWindow: boolean; x: number | null; y: number | null }> =>
    ipcRenderer.invoke("usp:get-window-pointer-state"),
  startTranscription: (): Promise<{ ok: boolean; error?: string; trackId?: string }> =>
    ipcRenderer.invoke("usp:start-transcription"),
  openSettingsWindow: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:open-settings-window"),
  getPluginCatalog: (): Promise<any[]> =>
    ipcRenderer.invoke("usp:get-plugin-catalog"),
  previewPluginInstall: (sourceUrl: string): Promise<any> =>
    ipcRenderer.invoke("usp:preview-plugin-install", sourceUrl),
  installPlugin: (sourceUrl: string, confirmedManifest: PluginManifest): Promise<any[]> =>
    ipcRenderer.invoke("usp:install-plugin", sourceUrl, confirmedManifest),
  updatePlugin: (pluginKey: string): Promise<any[]> =>
    ipcRenderer.invoke("usp:update-plugin", pluginKey),
  deletePlugin: (pluginKey: string): Promise<any[]> =>
    ipcRenderer.invoke("usp:delete-plugin", pluginKey),
  enablePlugin: (pluginKey: string): Promise<any[]> =>
    ipcRenderer.invoke("usp:enable-plugin", pluginKey),
  disablePlugin: (pluginKey: string): Promise<any[]> =>
    ipcRenderer.invoke("usp:disable-plugin", pluginKey),
  lookupWord: (token: string): Promise<any> => ipcRenderer.invoke("usp:word-lookup", token),
  openWordLookupWindow: (payload: any): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:word-lookup-window-open", payload),
  notifyWordLookupWindowPointerEnter: (): Promise<void> =>
    ipcRenderer.invoke("usp:word-lookup-window-pointer-enter"),
  notifyWordLookupWindowPointerLeave: (): Promise<void> =>
    ipcRenderer.invoke("usp:word-lookup-window-pointer-leave"),
  notifyWordLookupTriggerLeave: (): Promise<void> =>
    ipcRenderer.invoke("usp:word-lookup-trigger-leave"),
  resizeWordLookupWindow: (size: { width: number; height: number }): Promise<void> =>
    ipcRenderer.invoke("usp:word-lookup-window-resize", size),
  onWordLookupWindowPayload: (listener: Listener<any>) =>
    subscribe("word-lookup-window:payload", listener)
};

contextBridge.exposeInMainWorld("usp", api);

export type RendererApi = typeof api;
