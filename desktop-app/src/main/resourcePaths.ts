import { app } from "electron";
import path from "node:path";

export function resolveBundledResource(...segments: string[]) {
  const basePath = app.isPackaged
    ? process.resourcesPath
    : path.join(app.getAppPath(), "resources");

  return path.join(basePath, ...segments);
}
