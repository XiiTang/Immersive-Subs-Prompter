const { contextBridge, ipcRenderer } = require("electron");
import type { AppSettings } from "./main/types.js" with { "resolution-mode": "import" };

type Listener<T> = (payload: T) => void;
type FasterWhisperPaths = {
  binaryDir: string;
  modelsDir: string;
  cpuBinaryPath: string;
  gpuBinaryPath: string;
};
type FasterWhisperStatusResult =
  | {
      ok: true;
      paths: FasterWhisperPaths;
      binaryDownloadsSupported: boolean;
      binaryDownloadUnsupportedReason: string | null;
      binaries: { cpu: { exists: boolean; path: string }; gpu: { exists: boolean; path: string } };
      models: Array<{ name: string; path: string; folder: string }>;
      modelsBaseDir: string;
    }
  | { ok: false; error: string };

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
  getFasterWhisperPaths: (): Promise<FasterWhisperPaths> => ipcRenderer.invoke("usp:faster-whisper-paths"),
  getFasterWhisperStatus: (modelDir?: string): Promise<FasterWhisperStatusResult> =>
    ipcRenderer.invoke("usp:faster-whisper-status", modelDir),
  onFasterWhisperDownloadProgress: (
    listener: Listener<{
      id: string;
      type: "binary" | "model";
      variant?: "cpu" | "gpu";
      model?: string;
      percent: number;
      status: string;
    }>
  ) => subscribe("usp:faster-whisper-download-progress", listener),
  downloadFasterWhisperBinary: (
    payload: { variant: "cpu" | "gpu"; jobId?: string }
  ): Promise<{ ok: boolean; path?: string; id?: string; error?: string }> =>
    ipcRenderer.invoke("usp:faster-whisper-download-binary", payload),
  downloadFasterWhisperModel: (
    payload: { model: string; jobId?: string }
  ): Promise<{ ok: boolean; path?: string; files?: string[]; id?: string; error?: string }> =>
    ipcRenderer.invoke("usp:faster-whisper-download-model", payload),
  openPath: (targetPath: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:open-path", targetPath),
  openExternal: (url: string): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke("usp:open-external", url),
  selectWordListFile: (): Promise<{ canceled: boolean; path: string | null }> =>
    ipcRenderer.invoke("usp:select-word-list-file"),
  getCacheStats: (): Promise<{ totalEntries: number; totalSize: number; oldestEntry: number | null; newestEntry: number | null }> =>
    ipcRenderer.invoke("usp:cache-stats"),
  clearCache: (): Promise<{ success: boolean }> => ipcRenderer.invoke("usp:cache-clear"),
  cleanupCache: (): Promise<{ success: boolean; removedCount: number }> => ipcRenderer.invoke("usp:cache-cleanup"),
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
  enablePlugin: (pluginId: string): Promise<any[]> =>
    ipcRenderer.invoke("usp:enable-plugin", pluginId),
  disablePlugin: (pluginId: string): Promise<any[]> =>
    ipcRenderer.invoke("usp:disable-plugin", pluginId),
  lookupWord: (token: string): Promise<any> => ipcRenderer.invoke("usp:word-lookup", token),
  refreshWordLookup: (): Promise<any> => ipcRenderer.invoke("usp:word-lookup-refresh"),
  getWordLookupStatus: (): Promise<any> => ipcRenderer.invoke("usp:word-lookup-status"),
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
