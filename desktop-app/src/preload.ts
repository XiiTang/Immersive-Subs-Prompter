import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import { DesktopState, PlaybackState, VideoControlCommand } from "./main/types.js";

type Listener<T> = (payload: T) => void;

function subscribe<T>(channel: string, listener: Listener<T>) {
  const wrapped = (_event: IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
}

const api = {
  getInitialState: (): Promise<DesktopState> => ipcRenderer.invoke("usp:get-state"),
  onStateChange: (listener: Listener<DesktopState>) => subscribe("usp:state", listener),
  onPlayback: (listener: Listener<PlaybackState>) => subscribe("usp:time", listener),
  selectSubtitleTrack: (trackId: string | null) => ipcRenderer.invoke("usp:select-track", trackId),
  controlVideo: (command: VideoControlCommand) => ipcRenderer.invoke("usp:control", command)
};

contextBridge.exposeInMainWorld("usp", api);

export type RendererApi = typeof api;
