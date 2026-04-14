import { ipcMain } from "electron";
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
}
