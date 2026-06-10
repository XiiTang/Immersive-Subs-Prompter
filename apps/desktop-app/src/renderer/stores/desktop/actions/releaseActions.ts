import { reportError } from "../../../utils/errorBus";
import type { DesktopStoreThis } from "../types";

export async function refreshReleaseState(this: DesktopStoreThis) {
  this.releaseState = await window.usp.getReleaseState();
}

export async function checkForUpdates(this: DesktopStoreThis) {
  try {
    this.releaseState = await window.usp.checkForUpdates();
  } catch (error) {
    reportError(error, "release.check");
  }
}

export async function openReleaseDownload(this: DesktopStoreThis, url?: string) {
  const result = await window.usp.openReleaseDownload(url);
  if (!result.ok) {
    reportError(new Error(result.error ?? "Failed to open release download"), "release.open-download");
  }
}

export const releaseActions = {
  refreshReleaseState,
  checkForUpdates,
  openReleaseDownload
};
