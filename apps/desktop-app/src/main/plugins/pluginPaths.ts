import path from "path";
import { app } from "electron";

export function getRegistryPath(): string {
  return path.join(app.getPath("userData"), "plugins", "registry.json");
}
