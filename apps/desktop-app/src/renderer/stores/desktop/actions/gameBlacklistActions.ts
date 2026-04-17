import type { DesktopStoreThis } from "../types";

export function addGameProcess(this: DesktopStoreThis, processName: string) {
  const normalized = processName.trim();
  if (!this.settings || !normalized) {
    return;
  }
  const current = this.settings.global.gameProcessBlacklist ?? [];
  if (current.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
    return;
  }
  const nextList = [...current, normalized];
  this.updateGlobalSetting("gameProcessBlacklist", nextList);
}

export function removeGameProcess(this: DesktopStoreThis, processName: string) {
  if (!this.settings) {
    return;
  }
  const nextList = (this.settings.global.gameProcessBlacklist ?? []).filter(
    (entry) => entry.toLowerCase() !== processName.toLowerCase()
  );
  this.updateGlobalSetting("gameProcessBlacklist", nextList);
}

export const gameBlacklistActions = {
  addGameProcess,
  removeGameProcess
};
