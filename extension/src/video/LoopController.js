import { log, state } from "../content/state.js";
import { send } from "../connection/MessageSender.js";

function startLoopCheck() {
  if (state.loop.checkTimer) {
    clearInterval(state.loop.checkTimer);
  }

  state.loop.checkTimer = setInterval(() => {
    const video = state.activeVideo;
    if (!state.loop.isLooping || !video || state.loop.startMs === null || state.loop.endMs === null) {
      if (state.loop.checkTimer) {
        clearInterval(state.loop.checkTimer);
        state.loop.checkTimer = null;
      }
      return;
    }

    const currentTimeMs = video.currentTime * 1000;
    if (currentTimeMs >= state.loop.endMs) {
      state.loop.programmaticSeek = true;
      video.currentTime = state.loop.startMs / 1000;
    }
  }, 100);
}

export function clearLoopState() {
  if (state.loop.checkTimer) {
    clearInterval(state.loop.checkTimer);
    state.loop.checkTimer = null;
  }

  if (!state.loop.isLooping) {
    log.debug("loop", "clearLoopState called but not looping");
    state.loop.programmaticSeek = false;
    return;
  }

  state.loop.isLooping = false;
  state.loop.startMs = null;
  state.loop.endMs = null;
  state.loop.programmaticSeek = false;
  send("loop-cleared", {});
}

export function startLoop(target, startMs, endMs) {
  state.loop.startMs = startMs;
  state.loop.endMs = endMs;
  state.loop.isLooping = true;
  state.loop.programmaticSeek = true;

  const wasPaused = target.paused;
  target.currentTime = startMs / 1000;
  if (wasPaused) {
    target.play().catch((err) => {
      log.error("ctrl", "Auto-play after loop enabled failed", err);
    });
  }

  startLoopCheck();
  send("loop-started", {});
}

export function markProgrammaticSeek() {
  state.loop.programmaticSeek = true;
}

export function clearProgrammaticSeekFlag() {
  state.loop.programmaticSeek = false;
}

export function isProgrammaticSeek() {
  return state.loop.programmaticSeek;
}

export function isLooping() {
  return state.loop.isLooping;
}
