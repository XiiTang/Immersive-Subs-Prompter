import { ipcMain } from "electron";
import { startFeatureTranscription } from "../../features/transcriptionFeatureService.js";
import { IpcContext } from "../ipcRouter.js";

export function registerTranscriptionHandlers(context: IpcContext) {
  ipcMain.handle("usp:start-transcription", async () => {
    return startFeatureTranscription(context.transcriptionFeature);
  });
}
