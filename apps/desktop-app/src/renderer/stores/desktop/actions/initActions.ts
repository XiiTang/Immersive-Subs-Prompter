import type { DesktopStoreThis } from "../types";
import type { PlaybackState } from "../../../../main/types";

export async function initialize(this: DesktopStoreThis) {
  this.isInitializing = true;
  this.initError = null;
  try {
    const [state, settings, releaseState] = await Promise.all([
      window.usp.getInitialState(),
      window.usp.getSettings(),
      window.usp.getReleaseState()
    ]);
    this.desktopState = state;
    this.playback = state.playback;
    this.settings = settings;
    this.releaseState = releaseState;
    this.editingProfileId = state.appliedProfileId ?? settings.defaultProfileId;
    this.attachIpcListeners();
    await this.refreshCacheStats();
  } catch (error) {
    this.initError = error instanceof Error ? error.message : String(error);
  } finally {
    this.isInitializing = false;
  }
}

export function attachIpcListeners(this: DesktopStoreThis) {
  window.usp.onStateChange((nextState) => {
    const playback = this.playback && arePlaybackStatesEqual(this.playback, nextState.playback)
      ? this.playback
      : nextState.playback;
    this.desktopState = playback === nextState.playback ? nextState : { ...nextState, playback };
    this.playback = playback;
  });
  window.usp.onPlayback((payload) => {
    this.playback = payload;
    if (this.desktopState) {
      this.desktopState = { ...this.desktopState, playback: payload };
    }
  });
  window.usp.onSettingsChange((settings) => {
    this.settings = settings;
    if (!this.editingProfileId) {
      this.editingProfileId = this.desktopState?.appliedProfileId ?? settings.defaultProfileId;
    }
    this.refreshCacheStats();
  });
  window.usp.onReleaseStateChange((state) => {
    this.releaseState = state;
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

function arePlaybackStatesEqual(left: PlaybackState, right: PlaybackState): boolean {
  return (
    left.currentTime === right.currentTime &&
    left.duration === right.duration &&
    left.playbackRate === right.playbackRate &&
    left.lastUpdate === right.lastUpdate &&
    areLoopSnapshotsEqual(left.loop, right.loop)
  );
}

function areLoopSnapshotsEqual(left: PlaybackState["loop"], right: PlaybackState["loop"]): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return false;
  }
  return (
    left.status === right.status &&
    left.mode === right.mode &&
    left.startMs === right.startMs &&
    left.endMs === right.endMs &&
    left.startCueIndex === right.startCueIndex &&
    left.endCueIndex === right.endCueIndex &&
    left.anchorCueIndex === right.anchorCueIndex &&
    left.origin === right.origin &&
    left.boundaryTransition === right.boundaryTransition &&
    left.programmaticSeekReason === right.programmaticSeekReason
  );
}
