import { ipcMain } from "electron";
import { startPluginTranscription } from "../../pluginTranscriptionController.js";
import { IpcContext } from "../ipcRouter.js";

export function registerTranscriptionHandlers(context: IpcContext) {
  ipcMain.handle("usp:start-transcription", async () => {
    return startPluginTranscription({
      stateManager: context.stateManager,
      cacheManager: context.cacheManager,
      pluginManager: context.pluginManager,
      getPluginConfig: (pluginKey) => context.getSettings().plugins[pluginKey]?.config ?? {}
    });
  });
}
