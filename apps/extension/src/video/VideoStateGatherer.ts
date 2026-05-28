import { log, state } from "../content/state";
import { send } from "../connection/MessageSender";
import type { VideoSite, VideoStateSnapshot } from "@immersive-subs/contracts";
import type { PlaybackPrediction } from "../shared/types";

function detectSite(): VideoSite {
  const host = location.hostname;
  const site = host.includes("youtube.com") ? "youtube"
    : host.includes("bilibili.com") ? "bilibili"
      : host.includes("douyin.com") ? "douyin" : "unknown";
  log.debug("site", `Detected: ${site}`, { hostname: host });
  return site;
}

export function gatherVideoState(video: HTMLVideoElement): VideoStateSnapshot;
export function gatherVideoState(video: HTMLVideoElement | null): VideoStateSnapshot | null;
export function gatherVideoState(video: HTMLVideoElement | null): VideoStateSnapshot | null {
  if (!video) return null;
  return {
    pageUrl: location.href,
    site: detectSite(),
    videoSrc: video.currentSrc || video.src || null,
    videoWidth: Number.isFinite(video.videoWidth) ? video.videoWidth : null,
    videoHeight: Number.isFinite(video.videoHeight) ? video.videoHeight : null,
    pictureInPicture: document.pictureInPictureElement === video,
    playbackRate: video.playbackRate,
    currentTime: video.currentTime * 1000,
    duration: Number.isFinite(video.duration) ? video.duration * 1000 : null,
    paused: video.paused,
    muted: video.muted,
    volume: video.volume,
    readyState: video.readyState,
    title: document.title,
    updatedAt: Date.now(),
    loop:
      state.loop.isLooping && state.loop.mode && state.loop.startMs !== null && state.loop.endMs !== null && state.loop.origin
        ? {
          mode: state.loop.mode,
          startMs: state.loop.startMs,
          endMs: state.loop.endMs,
          startCueIndex: state.loop.startCueIndex,
          endCueIndex: state.loop.endCueIndex,
          anchorCueIndex: state.loop.anchorCueIndex,
          origin: state.loop.origin,
          status: "running",
          boundaryTransition: state.loop.boundaryTransition,
          programmaticSeekReason: state.loop.programmaticSeekReason
        }
        : null
  };
}

function recordPlaybackSample(snapshot: VideoStateSnapshot | null) {
  if (!snapshot) {
    return;
  }
  const playbackRate = Number.isFinite(snapshot.playbackRate) ? snapshot.playbackRate : 1;
  const effectiveRate = snapshot.paused ? 0 : playbackRate;
  state.lastReportedPlayback = {
    currentTime: snapshot.currentTime,
    playbackRate: effectiveRate,
    reportedAt: snapshot.updatedAt
  };
}

export function resetPlaybackPrediction() {
  state.lastReportedPlayback = null;
}

export function predictPlaybackTime(now = Date.now()) {
  if (!state.lastReportedPlayback) {
    return null;
  }
  const elapsed = now - state.lastReportedPlayback.reportedAt;
  return state.lastReportedPlayback.currentTime + elapsed * state.lastReportedPlayback.playbackRate;
}

export function handleTimeUpdate(video: HTMLVideoElement | null) {
  if (!state.monitoringActive) {
    return;
  }

  const snapshot = gatherVideoState(video);
  if (!snapshot) {
    return;
  }

  send("time-update", snapshot);
  recordPlaybackSample(snapshot);
}
