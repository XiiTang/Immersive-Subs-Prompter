import { globalShortcut } from "electron";
import { createLogger } from "../logger.js";

export class ShortcutManager {
  private readonly log = createLogger("desktop");
  private isBlockedByGame = false;
  private isRegistered = false;
  private lastRegisteredShortcut: string | null = null;
  private requestedShortcut: string | null = null;
  private hasLoggedMissingShortcut = false;
  private handler: (() => void) | null = null;

  applyShortcut(shortcut: string, handler: () => void) {
    this.requestedShortcut = shortcut?.trim() ?? "";
    this.handler = handler;

    if (!this.requestedShortcut) {
      if (!this.hasLoggedMissingShortcut) {
        this.log.warn("No global shortcut configured");
        this.hasLoggedMissingShortcut = true;
      }
      this.clearRegistration();
      return;
    }

    this.hasLoggedMissingShortcut = false;

    if (this.isBlockedByGame) {
      return;
    }

    this.setShortcutHandlingSuspended(false);

    if (this.isRegistered && this.lastRegisteredShortcut === this.requestedShortcut) {
      return;
    }

    this.clearRegistration();

    try {
      const success = globalShortcut.register(this.requestedShortcut, handler);
      if (success) {
        this.isRegistered = true;
        this.lastRegisteredShortcut = this.requestedShortcut;
        this.log.info(`Global shortcut registered: ${this.requestedShortcut}`);
      } else {
        this.log.error(`Failed to register shortcut: ${this.requestedShortcut} (may be in use)`);
      }
    } catch (error) {
      this.log.error(`Exception registering shortcut: ${this.requestedShortcut}`, error);
    }
  }

  clearRegistration() {
    globalShortcut.unregisterAll();
    this.isRegistered = false;
    this.lastRegisteredShortcut = null;
  }

  blockForGame() {
    if (this.isBlockedByGame) {
      return;
    }
    this.isBlockedByGame = true;
    this.setShortcutHandlingSuspended(true);
  }

  unblockAfterGame() {
    if (!this.isBlockedByGame) {
      return;
    }
    this.isBlockedByGame = false;
    this.setShortcutHandlingSuspended(false);
    if (
      this.requestedShortcut
      && this.handler
      && (!this.isRegistered || this.lastRegisteredShortcut !== this.requestedShortcut)
    ) {
      this.applyShortcut(this.requestedShortcut, this.handler);
    }
  }

  private setShortcutHandlingSuspended(suspended: boolean) {
    try {
      if (globalShortcut.isSuspended() === suspended) {
        return;
      }
      globalShortcut.setSuspended(suspended);
    } catch (error) {
      this.log.error(
        `Failed to ${suspended ? "suspend" : "resume"} global shortcuts`,
        error
      );
    }
  }
}
