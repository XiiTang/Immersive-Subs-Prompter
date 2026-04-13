import { log, state } from "../content/state";
import { send } from "../connection/MessageSender";
import { clearLoopState, startLoop } from "./LoopController";
import { handleTimeUpdate } from "./VideoStateGatherer";
import type { ControlAction, ControlPayload } from "../shared/types";

export function applyControl(action: ControlAction, payload: ControlPayload) {
  if (!state.monitoringActive) {
    return;
  }

  const target = state.activeVideo || document.querySelector("video");
  if (!target) {
    log.warn("ctrl", `Failed to execute: ${action} (no video)`);
    return;
  }

  switch (action) {
    case "seek":
      clearLoopState();
      if (typeof payload.time === "number" && Number.isFinite(payload.time)) {
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
      } else {
        log.warn("ctrl", "seek failed: invalid time", payload);
      }
      break;
    case "loop":
      if (
        (payload.mode === "single" || payload.mode === "ab") &&
        typeof payload.startMs === "number" &&
        typeof payload.endMs === "number" &&
        Number.isFinite(payload.startMs) &&
        Number.isFinite(payload.endMs)
      ) {
        log.debug("ctrl", "loop requested", {
          mode: payload.mode,
          startMs: payload.startMs,
          endMs: payload.endMs,
          before: Math.round(target.currentTime * 1000)
        });
        startLoop(target, {
          mode: payload.mode,
          startMs: payload.startMs,
          endMs: payload.endMs,
          startCueIndex: typeof payload.startCueIndex === "number" ? payload.startCueIndex : null,
          endCueIndex: typeof payload.endCueIndex === "number" ? payload.endCueIndex : null,
          anchorCueIndex: typeof payload.anchorCueIndex === "number" ? payload.anchorCueIndex : null,
          origin: payload.origin === "ab-loop" ? "ab-loop" : "single-loop"
        });
        log.debug("ctrl", "loop applied", { after: Math.round(target.currentTime * 1000) });
      } else {
        log.warn("ctrl", "loop failed: invalid times", payload);
        send("loop-cleared", {});
      }
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
    default:
      log.warn("ctrl", `Unknown command: ${action}`);
      break;
  }
}
