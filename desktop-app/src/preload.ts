const { contextBridge, ipcRenderer } = require("electron");

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
  selectSubtitleTrack: (trackId: string | null) => ipcRenderer.invoke("usp:select-track", trackId),
  controlVideo: (command: any) => ipcRenderer.invoke("usp:control", command)
};

contextBridge.exposeInMainWorld("usp", api);

export type RendererApi = typeof api;
