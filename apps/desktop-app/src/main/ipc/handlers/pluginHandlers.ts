import { ipcMain } from "electron";
import type { PluginManifest } from "../../plugins/pluginManifest.js";
import { IpcContext } from "../ipcRouter.js";

export function registerPluginHandlers(context: IpcContext) {
  ipcMain.handle("usp:get-plugin-catalog", async () => {
    return context.pluginManager.listCatalog();
  });

  ipcMain.handle("usp:preview-plugin-install", async (_event, sourceUrl: string) => {
    return context.pluginManager.previewInstall(sourceUrl);
  });

  ipcMain.handle("usp:install-plugin", async (_event, sourceUrl: string, confirmedManifest: PluginManifest) => {
    const catalog = await context.pluginManager.install(sourceUrl, confirmedManifest);
    await context.pushPluginCatalog();
    return catalog;
  });

  ipcMain.handle("usp:update-plugin", async (_event, pluginKey: string) => {
    const catalog = await context.pluginManager.update(pluginKey);
    await context.pushPluginCatalog();
    return catalog;
  });

  ipcMain.handle("usp:delete-plugin", async (_event, pluginKey: string) => {
    const catalog = await context.pluginManager.delete(pluginKey);
    await context.pushPluginCatalog();
    return catalog;
  });

  ipcMain.handle("usp:enable-plugin", async (_event, pluginKey: string) => {
    const catalog = await context.pluginManager.enable(pluginKey);
    await context.pushPluginCatalog();
    return catalog;
  });

  ipcMain.handle("usp:disable-plugin", async (_event, pluginKey: string) => {
    const catalog = await context.pluginManager.disable(pluginKey);
    await context.pushPluginCatalog();
    return catalog;
  });

  ipcMain.handle("usp:word-lookup", async (_event, token: string) => {
    return context.pluginManager.lookupWord(token);
  });

}
