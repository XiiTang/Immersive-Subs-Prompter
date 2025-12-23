import { DRIFT_CHECK_INTERVAL_MS, DRIFT_THRESHOLD_MS } from "../content/constants.js";
import { log, state } from "../content/state.js";
import { handleTimeUpdate, predictPlaybackTime } from "../video/VideoStateGatherer.js";
import { endActiveVideoSession } from "../video/VideoDetector.js";

export function ensureDriftMonitor() {
  if (state.driftMonitorTimer || !state.monitoringActive) {
    return;
  }

  const tick = () => {
    if (!state.monitoringActive || !state.activeVideo) {
      state.driftMonitorTimer = null;
      return;
    }

    if (!state.activeVideo.isConnected) {
      endActiveVideoSession("removed-from-dom");
      state.driftMonitorTimer = null;
      return;
    }

    const predicted = predictPlaybackTime();
    if (predicted !== null) {
      const actual = state.activeVideo.currentTime * 1000;
      if (Math.abs(predicted - actual) > DRIFT_THRESHOLD_MS) {
        log.debug("drift", "Playback drift detected", {
          predicted: Math.round(predicted),
          actual: Math.round(actual)
        });
        handleTimeUpdate(state.activeVideo);
      }
    }

    state.driftMonitorTimer = window.setTimeout(tick, DRIFT_CHECK_INTERVAL_MS);
  };

  state.driftMonitorTimer = window.setTimeout(tick, DRIFT_CHECK_INTERVAL_MS);
}

export function stopDriftMonitor() {
  if (state.driftMonitorTimer) {
    clearTimeout(state.driftMonitorTimer);
    state.driftMonitorTimer = null;
  }
}
