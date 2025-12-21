import { app, Menu, nativeImage, Tray } from "electron";

type TrayManagerOptions = {
  getIconPath: () => string;
  onShow: () => void;
  onQuit: () => void;
};

export class TrayManager {
  private tray: Tray | null = null;

  constructor(private readonly options: TrayManagerOptions) {}

  ensureTray() {
    if (this.tray) {
      return;
    }

    const iconPath = this.options.getIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    this.tray = new Tray(icon);
    this.tray.setToolTip("Immersive Subs Prompter");
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: "Show Window",
          click: () => this.options.onShow()
        },
        { type: "separator" },
        {
          label: "Quit",
          click: () => {
            this.options.onQuit();
            this.destroy();
            app.quit();
          }
        }
      ])
    );
    this.tray.on("click", () => {
      this.options.onShow();
    });
  }

  destroy() {
    if (!this.tray) {
      return;
    }
    this.tray.destroy();
    this.tray = null;
  }
}
