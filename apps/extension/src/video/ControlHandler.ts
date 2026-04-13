import { log, state } from "../content/state";
import { send } from "../connection/MessageSender";
import { clearLoopState, startLoop } from "./LoopController";
import { handleTimeUpdate } from "./VideoStateGatherer";
import type { ControlMessage } from "../shared/types";

export function applyControl(message: ControlMessage) {
  if (!state.monitoringActive) {
    return;
  }

  const target = state.activeVideo || document.querySelector("video");
  if (!target) {
    log.warn("ctrl", `Failed to execute: ${message.action} (no video)`);
    return;
  }

  switch (message.action) {
    case "seek": {
      const { payload } = message;
      clearLoopState();
      log.debug("ctrl", "seek requested", { ms: payload.time, before: Math.round(target.currentTime * 1000) });
      const timeInSeconds = payload.time / 1000;
      const clamped = Math.max(0, Math.min(timeInSeconds, target.duration || timeInSeconds));
      const wasPaused = target.paused;
      target.currentTime = clamped;
      log.debug("ctrl", "seek applied", { after: Math.round(target.currentTime * 1000) });
      if (wasPaused) {
        target.play().catch((err) => {
          log.error("ctrl", "Auto-play after seek failed", err);
        });
      }
      handleTimeUpdate(target);
      break;
    }
    case "loop":
      log.debug("ctrl", "loop requested", {
        mode: message.payload.mode,
        startMs: message.payload.startMs,
        endMs: message.payload.endMs,
        before: Math.round(target.currentTime * 1000)
      });
      startLoop(target, message.payload);
      log.debug("ctrl", "loop applied", { after: Math.round(target.currentTime * 1000) });
      break;
    case "stopLoop":
      log.debug("ctrl", "stopLoop requested");
      clearLoopState();
      break;
    case "pause":
      log.debug("ctrl", "pause requested", { time: Math.round(target.currentTime * 1000) });
      clearLoopState();
      target.pause();
      log.debug("ctrl", "pause applied");
      break;
    case "play":
      log.debug("ctrl", "play requested", { time: Math.round(target.currentTime * 1000) });
      clearLoopState();
      target.play().catch((err) => {
        log.error("ctrl", "play failed", err);
      });
      log.debug("ctrl", "play applied");
      break;
  }
}
