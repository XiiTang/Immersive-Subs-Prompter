import { log, state } from "../content/state";
import { send } from "../connection/MessageSender";
import { handleTimeUpdate } from "./VideoStateGatherer";
import type { LoopSnapshot } from "../shared/types";
import type { LoopSession } from "@immersive-subs/contracts";

function buildLoopPayload(): LoopSnapshot | null {
  if (!state.loop.isLooping || state.loop.startMs === null || state.loop.endMs === null || !state.loop.mode) {
    return null;
  }

  return {
    mode: state.loop.mode,
    startMs: state.loop.startMs,
    endMs: state.loop.endMs,
    startCueIndex: state.loop.startCueIndex,
    endCueIndex: state.loop.endCueIndex,
    anchorCueIndex: state.loop.anchorCueIndex,
    origin: state.loop.origin as LoopSession["origin"],
    status: "running",
    boundaryTransition: state.loop.boundaryTransition,
    programmaticSeekReason: state.loop.programmaticSeekReason
  };
}

function resetLoopStateFields() {
  state.loop.mode = null;
  state.loop.startMs = null;
  state.loop.endMs = null;
  state.loop.startCueIndex = null;
  state.loop.endCueIndex = null;
  state.loop.anchorCueIndex = null;
  state.loop.origin = null;
  state.loop.isLooping = false;
  state.loop.programmaticSeekReason = "manual-control";
  state.loop.boundaryTransition = "none";
}

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
      state.loop.programmaticSeekReason = "loop-wrap";
      state.loop.boundaryTransition = "loop-wrap";
      video.currentTime = state.loop.startMs / 1000;
      handleTimeUpdate(video);
      state.loop.boundaryTransition = "none";
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
    resetLoopStateFields();
    return;
  }

  resetLoopStateFields();
  send("loop-cleared", {});
}

export function startLoop(target: HTMLVideoElement, session: LoopSession) {
  state.loop.mode = session.mode;
  state.loop.startMs = session.startMs;
  state.loop.endMs = session.endMs;
  state.loop.startCueIndex = session.startCueIndex;
  state.loop.endCueIndex = session.endCueIndex;
  state.loop.anchorCueIndex = session.anchorCueIndex;
  state.loop.origin = session.origin;
  state.loop.isLooping = true;
  state.loop.programmaticSeekReason = "manual-control";
  state.loop.boundaryTransition = "none";

  const wasPaused = target.paused;
  target.currentTime = session.startMs / 1000;
  handleTimeUpdate(target);
  if (wasPaused) {
    target.play().catch((err) => {
      log.error("loop", "Auto-play after loop enabled failed", err);
    });
  }

  startLoopCheck();
  send("loop-started", buildLoopPayload());
}

export function clearProgrammaticSeekFlag() {
  if (state.loop.boundaryTransition !== "loop-wrap") {
    state.loop.programmaticSeekReason = "none";
  }
}

export function isProgrammaticSeek() {
  return state.loop.programmaticSeekReason !== "none";
}
