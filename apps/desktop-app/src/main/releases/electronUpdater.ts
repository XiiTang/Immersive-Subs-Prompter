import electronUpdater from "electron-updater";
import type { UpdaterLike } from "../appReleaseService.js";

export function getElectronAutoUpdater(): UpdaterLike {
  return electronUpdater.autoUpdater;
}
