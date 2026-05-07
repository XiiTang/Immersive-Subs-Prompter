import { ipcMain } from "electron";
import { WORD_LOOKUP_PLUGIN_ID } from "../../../common/pluginIds.js";
import { IpcContext } from "../ipcRouter.js";

export function registerPluginHandlers(context: IpcContext) {
  ipcMain.handle("usp:get-plugin-catalog", async () => {
    return context.pluginHost.listCatalog();
  });

  ipcMain.handle("usp:enable-plugin", async (_event, pluginId: string) => {
    await context.pluginHost.enable(pluginId);
    await context.pushPluginCatalog();
    return context.pluginHost.listCatalog();
  });

  ipcMain.handle("usp:disable-plugin", async (_event, pluginId: string) => {
    await context.pluginHost.disable(pluginId);
    await context.pushPluginCatalog();
    return context.pluginHost.listCatalog();
  });

  ipcMain.handle("usp:word-lookup", async (_event, token: string) => {
    const command = context.pluginHost.getCommand(WORD_LOOKUP_PLUGIN_ID, "lookup");
    if (!command) {
      return { token, normalizedToken: "", matches: [] };
    }
    return command(token);
  });

  ipcMain.handle("usp:word-lookup-refresh", async () => {
    const command = context.pluginHost.getCommand(WORD_LOOKUP_PLUGIN_ID, "refresh");
    if (!command) {
      return {
        ok: false,
        wordListPath: "",
        entryCount: 0,
        fileMtimeMs: null,
        loadedAt: null,
        error: "Word Lookup plugin is disabled."
      };
    }
    return command();
  });

  ipcMain.handle("usp:word-lookup-status", async () => {
    const command = context.pluginHost.getCommand(WORD_LOOKUP_PLUGIN_ID, "getStatus");
    if (!command) {
      return {
        ok: false,
        wordListPath: "",
        entryCount: 0,
        fileMtimeMs: null,
        loadedAt: null,
        error: "Word Lookup plugin is disabled."
      };
    }
    return command();
  });
}
