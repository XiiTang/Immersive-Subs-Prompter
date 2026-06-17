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

export async function downloadReleaseUpdate(this: DesktopStoreThis) {
  try {
    this.releaseState = await window.usp.downloadReleaseUpdate();
  } catch (error) {
    reportError(error, "release.download");
  }
}

export async function installReleaseUpdate(this: DesktopStoreThis) {
  const result = await window.usp.installReleaseUpdate();
  if (!result.ok) {
    reportError(new Error(result.error ?? "Failed to install release update"), "release.install");
  }
}

export const releaseActions = {
  refreshReleaseState,
  checkForUpdates,
  downloadReleaseUpdate,
  installReleaseUpdate
};
