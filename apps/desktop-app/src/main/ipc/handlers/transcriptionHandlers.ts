import { ipcMain } from "electron";
import { IpcContext } from "../ipcRouter.js";

export function registerTranscriptionHandlers(context: IpcContext) {
  ipcMain.handle("usp:start-transcription", async () => {
    const run = context.pluginHost?.getCommand("official.transcription", "startTranscription");
    if (!run) {
      return { ok: false, error: "Speech Transcription plugin is not enabled." };
    }
    return run();
  });
}
