import { app, Menu, nativeImage, Tray } from "electron";
import { translate, normalizeLanguage, type SupportedLanguage } from "../i18n.js";

const TRAY_GUID = "5a9e94eb-3edc-4890-aa7c-f6b743923830";

type TrayManagerOptions = {
  getTrayIconPath: () => string;
  getLanguage: () => string;
  onShow: () => void;
  onQuickShow: () => void;
};

export class TrayManager {
  private tray: Tray | null = null;
  private currentLanguage: SupportedLanguage = "en";

  constructor(private readonly options: TrayManagerOptions) { }

  ensureTray() {
    if (this.tray) {
      return;
    }

    const iconPath = this.options.getTrayIconPath();
    const icon = nativeImage.createFromPath(iconPath);
    if (process.platform === "darwin") {
      icon.setTemplateImage(true);
    }
    this.tray = new Tray(icon, TRAY_GUID);
    this.tray.setToolTip("Immersive Subs Prompter");
    this.currentLanguage = normalizeLanguage(this.options.getLanguage());
    this.updateContextMenu();
    this.tray.on("click", () => {
      this.options.onShow();
    });
  }

  /**
   * Update tray menu language. Call this when language setting changes.
   */
  updateLanguage() {
    const newLanguage = normalizeLanguage(this.options.getLanguage());
    if (this.tray && newLanguage !== this.currentLanguage) {
      this.currentLanguage = newLanguage;
      this.updateContextMenu();
    }
  }

  private updateContextMenu() {
    if (!this.tray) {
      return;
    }
    const lang = this.currentLanguage;
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: translate("tray-show-window", lang),
          click: () => this.options.onShow()
        },
        {
          label: translate("tray-quick-show", lang),
          click: () => this.options.onQuickShow()
        },
        { type: "separator" },
        {
          label: translate("tray-quit", lang),
          click: () => {
            this.destroy();
            app.quit();
          }
        }
      ])
    );
  }

  destroy() {
    if (!this.tray) {
      return;
    }
    this.tray.destroy();
    this.tray = null;
  }
}
