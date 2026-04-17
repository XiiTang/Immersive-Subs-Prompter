import type { DesktopStoreThis } from "../types";

export async function initialize(this: DesktopStoreThis) {
  this.isInitializing = true;
  this.initError = null;
  try {
    const [state, settings] = await Promise.all([window.usp.getInitialState(), window.usp.getSettings()]);
    this.desktopState = state;
    this.playback = state.playback;
    this.settings = settings;
    this.editingProfileId = state.appliedProfileId ?? settings.defaultProfileId ?? settings.profiles[0]?.id ?? null;
    this.attachIpcListeners();
    await this.refreshCacheStats();
    await this.refreshPluginCatalog();
  } catch (error) {
    this.initError = error instanceof Error ? error.message : String(error);
  } finally {
    this.isInitializing = false;
  }
}

export function attachIpcListeners(this: DesktopStoreThis) {
  window.usp.onStateChange((nextState) => {
    this.desktopState = nextState;
    this.playback = nextState.playback;
  });
  window.usp.onPlayback((payload) => {
    this.playback = payload;
    if (this.desktopState) {
      this.desktopState = { ...this.desktopState, playback: payload };
    }
  });
  window.usp.onSettingsChange((settings) => {
    this.settings = settings;
    if (!this.editingProfileId && settings.profiles.length) {
      this.editingProfileId = this.desktopState?.appliedProfileId ?? settings.defaultProfileId ?? settings.profiles[0].id;
    }
    this.refreshCacheStats();
  });
  window.usp.onPluginCatalogChange((catalog) => {
    this.pluginCatalog = catalog;
  });
  window.usp.onLoopCleared(() => {
    if (this.playback) {
      this.playback = { ...this.playback, loop: null };
    }
  });
}

export const initActions = {
  initialize,
  attachIpcListeners
};
