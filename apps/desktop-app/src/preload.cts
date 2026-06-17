const { contextBridge, ipcRenderer } = require("electron");
import type { AppSettings } from "./main/types.js" with { "resolution-mode": "import" };
import type { CacheStats } from "./main/subtitleCacheManager.js" with { "resolution-mode": "import" };
import type { ReleaseState } from "./main/releases/releaseState.js" with { "resolution-mode": "import" };

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
  selectWordListFile: (): Promise<{ canceled: boolean; path: string | null }> =>
    ipcRenderer.invoke("usp:select-word-list-file"),
  getReleaseState: (): Promise<ReleaseState> => ipcRenderer.invoke("usp:get-release-state"),
  checkForUpdates: (): Promise<ReleaseState> => ipcRenderer.invoke("usp:check-for-updates"),
  downloadReleaseUpdate: (): Promise<ReleaseState> =>
    ipcRenderer.invoke("usp:download-release-update"),
  installReleaseUpdate: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:install-release-update"),
  onReleaseStateChange: (listener: Listener<ReleaseState>) => subscribe("usp:release-state", listener),
  openPath: (targetPath: string): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:open-path", targetPath),
  getCacheStats: (): Promise<CacheStats> =>
    ipcRenderer.invoke("usp:cache-stats"),
  openCacheFolder: (): Promise<void> => ipcRenderer.invoke("usp:cache-open-folder"),
  toggleDisplayFullscreen: (): Promise<boolean> => ipcRenderer.invoke("usp:toggle-display-fullscreen"),
  getWindowPointerState: (): Promise<{ insideWindow: boolean; x: number | null; y: number | null }> =>
    ipcRenderer.invoke("usp:get-window-pointer-state"),
  startTranscription: (): Promise<{ ok: boolean; error?: string; trackId?: string }> =>
    ipcRenderer.invoke("usp:start-transcription"),
  getFasterWhisperPaths: (): Promise<{
    binaryDir: string;
    modelsDir: string;
    cpuBinaryPath: string;
    gpuBinaryPath: string;
  }> => ipcRenderer.invoke("usp:faster-whisper-paths"),
  getFasterWhisperStatus: (modelDir?: string): Promise<any> =>
    ipcRenderer.invoke("usp:faster-whisper-status", modelDir),
  listFasterWhisperModels: (modelDir?: string): Promise<any> =>
    ipcRenderer.invoke("usp:faster-whisper-list-models", modelDir),
  downloadFasterWhisperBinary: (payload: { variant: "cpu" | "gpu"; jobId?: string }): Promise<any> =>
    ipcRenderer.invoke("usp:faster-whisper-download-binary", payload),
  downloadFasterWhisperModel: (payload: { model: string; modelDir?: string; jobId?: string }): Promise<any> =>
    ipcRenderer.invoke("usp:faster-whisper-download-model", payload),
  onFasterWhisperDownloadProgress: (listener: Listener<any>) =>
    subscribe("usp:faster-whisper-download-progress", listener),
  openSettingsWindow: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("usp:open-settings-window"),
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
