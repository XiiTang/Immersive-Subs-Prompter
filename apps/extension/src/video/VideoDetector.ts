import { log, state } from "../content/state";
import { send } from "../connection/MessageSender";
import { ensureDocListeners, scanForShadowRoots } from "../monitoring/DOMObserver";
import { ensureDriftMonitor, stopDriftMonitor } from "../monitoring/DriftMonitor";
import { clearLoopState, clearProgrammaticSeekFlag, isProgrammaticSeek } from "./LoopController";
import { gatherVideoState, handleTimeUpdate, resetPlaybackPrediction } from "./VideoStateGatherer";
import type { BackgroundToContentMessage } from "../shared/types";

function setActiveVideo(video: HTMLVideoElement | null) {
  if (!state.monitoringActive) {
    return;
  }
  const nextVideo = video ?? null;
  const switchedVideo = state.activeVideo !== nextVideo;
  state.activeVideo = nextVideo;
  if (nextVideo) {
    log.info("video", "Video activated", { src: nextVideo.currentSrc || nextVideo.src, duration: nextVideo.duration });
    const snapshot = gatherVideoState(nextVideo);
    send("video-context", snapshot);
    if (switchedVideo) {
      resetPlaybackPrediction();
    }
    ensureDriftMonitor();
  } else {
    log.info("video", "Video cleared");
    stopDriftMonitor();
    resetPlaybackPrediction();
  }
}

export function endActiveVideoSession(reason = "ended") {
  if (!state.activeVideo) {
    return;
  }
  const src = state.activeVideo.currentSrc || state.activeVideo.src || "(no src)";
  clearLoopState();
  log.info("video", `Video ${reason}`, { src });
  send("video-ended", {});
  setActiveVideo(null);
}

function watchVideo(video: HTMLVideoElement | null) {
  if (!state.monitoringActive || !video || !(video instanceof HTMLVideoElement)) return;
  if (state.hooked.has(video)) return;
  state.hooked.add(video);
  log.info("video", "Video detected", {
    src: video.currentSrc || video.src || "(no src)",
    duration: video.duration,
    readyState: video.readyState
  });
  handleTimeUpdate(video);
}

export function handleDocumentMediaEvent(event: Event | { type: string; target: EventTarget | null }) {
  if (!state.monitoringActive) {
    return;
  }
  const target = event?.target;
  if (!(target instanceof HTMLVideoElement)) return;

  log.debug("event", event.type, {
    time: target.currentTime?.toFixed(1),
    paused: target.paused,
    active: target === state.activeVideo
  });

  watchVideo(target);
  switch (event.type) {
    case "play":
    case "playing":
      setActiveVideo(target);
      handleTimeUpdate(target);
      break;
    case "timeupdate":
      if (target === state.activeVideo) {
        handleTimeUpdate(target);
      }
      break;
    case "loadedmetadata":
      if (!state.activeVideo) {
        setActiveVideo(target);
      } else {
        const snapshot = gatherVideoState(target);
        send("video-context", snapshot);
      }
      break;
    case "loadeddata":
      if (!state.activeVideo) {
        setActiveVideo(target);
      }
      handleTimeUpdate(target);
      break;
    case "pause":
      if (target === state.activeVideo) {
        clearLoopState();
        handleTimeUpdate(target);
      }
      break;
    case "seeking":
      if (target === state.activeVideo && !isProgrammaticSeek()) {
        clearLoopState();
      }
      clearProgrammaticSeekFlag();
      break;
    case "seeked":
      clearProgrammaticSeekFlag();
      if (target === state.activeVideo) {
        handleTimeUpdate(target);
      }
      break;
    case "durationchange":
    case "volumechange":
    case "enterpictureinpicture":
    case "leavepictureinpicture":
    case "ratechange":
      if (state.activeVideo === target) {
        handleTimeUpdate(target);
      }
      break;
    case "ended":
      if (state.activeVideo === target) {
        endActiveVideoSession("playback-ended");
      }
      break;
    default:
      break;
  }
}

export function ensurePrototypeHooks() {
  if (state.prototypesHooked) {
    return;
  }
  state.prototypesHooked = true;

  (["play", "pause", "load"] as const).forEach((methodName) => {
    const original = HTMLMediaElement.prototype[methodName];
    if (typeof original !== "function") return;
    const patched = function (this: HTMLMediaElement) {
      const result = original.call(this);
      if (this instanceof HTMLVideoElement) {
        watchVideo(this);
      }
      return result;
    };
    patched.toString = () => original.toString();
    (HTMLMediaElement.prototype as Record<typeof methodName, typeof original>)[methodName] = patched as typeof original;
  });

  const originalAttachShadow = Element.prototype.attachShadow;
  if (typeof originalAttachShadow === "function") {
    Element.prototype.attachShadow = function (...args: Parameters<Element["attachShadow"]>) {
      const shadowRoot = originalAttachShadow.apply(this, args);
      log.info("shadow", "attachShadow called", { host: this.tagName, mode: args[0]?.mode });
      ensureDocListeners(shadowRoot);
      scanForShadowRoots(shadowRoot);
      return shadowRoot;
    };
    Element.prototype.attachShadow.toString = () => originalAttachShadow.toString();
  }
}
