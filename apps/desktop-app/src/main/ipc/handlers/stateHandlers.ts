import { ipcMain } from "electron";
import { VideoControlCommand } from "../../types.js";
import { IpcContext } from "../ipcRouter.js";

export function registerStateHandlers(context: IpcContext) {
  ipcMain.handle("usp:get-state", () => {
    return context.stateManager.getState();
  });

  ipcMain.handle("usp:control", (_event, command: VideoControlCommand) => {
    context.logger.debug("IPC usp:control invoked", { type: command?.type });
    const ok = context.connectionManager.sendControlCommand(command);
    context.logger.debug("IPC usp:control completed", { ok });
    return ok;
  });
}
