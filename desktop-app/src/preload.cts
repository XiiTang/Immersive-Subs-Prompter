const { contextBridge, ipcRenderer } = require("electron");
import type { AppSettings } from "./main/types";

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
  getFasterWhisperPaths: (): Promise<{
    binaryDir: string;
    modelsDir: string;
    cpuBinaryPath: string;
    gpuBinaryPath: string;
  }> => ipcRenderer.invoke("usp:faster-whisper-paths"),
  listFasterWhisperModels: (
    modelDir?: string
  ): Promise<{ ok: boolean; models?: Array<{ name: string; path: string; folder: string }>; baseDir?: string; error?: string }> =>
    ipcRenderer.invoke("usp:faster-whisper-list-models", modelDir),
  getFasterWhisperStatus: (
    modelDir?: string
  ): Promise<{
    ok: boolean;
    paths?: { binaryDir: string; modelsDir: string; cpuBinaryPath: string; gpuBinaryPath: string };
    binaries?: { cpu: { exists: boolean; path: string }; gpu: { exists: boolean; path: string } };
    models?: Array<{ name: string; path: string; folder: string }>;
    modelsBaseDir?: string;
    error?: string;
  }> => ipcRenderer.invoke("usp:faster-whisper-status", modelDir),
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
  getCacheStats: (): Promise<{ totalEntries: number; totalSize: number; oldestEntry: number | null; newestEntry: number | null }> =>
    ipcRenderer.invoke("usp:cache-stats"),
  clearCache: (): Promise<{ success: boolean }> => ipcRenderer.invoke("usp:cache-clear"),
  cleanupCache: (): Promise<{ success: boolean; removedCount: number }> => ipcRenderer.invoke("usp:cache-cleanup"),
  openCacheFolder: (): Promise<void> => ipcRenderer.invoke("usp:cache-open-folder"),
  toggleDisplayFullscreen: (): Promise<boolean> => ipcRenderer.invoke("usp:toggle-display-fullscreen"),
  startTranscription: (): Promise<{ ok: boolean; error?: string; trackId?: string }> =>
    ipcRenderer.invoke("usp:start-transcription"),
  // 窗口拖拽 API (使用 Windows 原生 SC_MOVE 命令，无需轮询，无尺寸漂移)
  startWindowDrag: (): Promise<{ success: boolean; native?: boolean; error?: string }> => 
    ipcRenderer.invoke("usp:start-window-drag")
};

contextBridge.exposeInMainWorld("usp", api);

export type RendererApi = typeof api;
