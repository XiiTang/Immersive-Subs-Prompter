import { BrowserWindow, screen } from "electron";
import { StateManager } from "../stateManager.js";

export class DisplayManager {
  private isDisplayFullscreen = false;
  private previousBounds: Electron.Rectangle | null = null;

  constructor(private readonly stateManager: StateManager) {}

  toggleFullscreen(window: BrowserWindow | null): boolean {
    if (!window) {
      return false;
    }

    if (this.isDisplayFullscreen) {
      if (this.previousBounds) {
        window.setBounds(this.previousBounds);
      }
      this.previousBounds = null;
      this.isDisplayFullscreen = false;
      this.stateManager.setFullscreen(false);
      return false;
    }

    const currentBounds = window.getBounds();
    const targetDisplay = screen.getDisplayMatching(currentBounds);
    this.previousBounds = currentBounds;
    window.setBounds(targetDisplay.bounds);
    this.isDisplayFullscreen = true;
    this.stateManager.setFullscreen(true);
    return true;
  }

  reset() {
    this.previousBounds = null;
    this.isDisplayFullscreen = false;
  }
}
