import { app } from "electron";
import fs from "fs";
import path from "path";
import { createLogger } from "../logger.js";

export class AutoLaunchManager {
  private readonly log = createLogger("desktop");

  apply(enabled: boolean) {
    if (process.platform === "win32" || process.platform === "darwin") {
      try {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          path: process.execPath
        });
      } catch (error) {
        this.log.error("Failed to update login item settings", error);
      }
      return;
    }

    if (process.platform === "linux") {
      const desktopFile = this.getAutostartDesktopEntryPath();
      try {
        if (enabled) {
          fs.mkdirSync(path.dirname(desktopFile), { recursive: true });
          const execPath = process.execPath;
          const entry = [
            "[Desktop Entry]",
            "Type=Application",
            "Version=1.0",
            "Name=Immersive Subs Prompter",
            `Exec=\"${execPath}\"`,
            "Terminal=false",
            "X-GNOME-Autostart-enabled=true"
          ].join("\n");
          fs.writeFileSync(desktopFile, `${entry}\n`, "utf-8");
        } else if (fs.existsSync(desktopFile)) {
          fs.rmSync(desktopFile);
        }
      } catch (error) {
        this.log.error("Failed to update autostart entry", error);
      }
    }
  }

  private getAutostartDesktopEntryPath() {
    const configDir = path.join(app.getPath("home"), ".config", "autostart");
    return path.join(configDir, "immersive-subs-prompter.desktop");
  }
}
