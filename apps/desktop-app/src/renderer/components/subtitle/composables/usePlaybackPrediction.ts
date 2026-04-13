import { computed, onWatcherCleanup, ref, watch } from "vue";
import type { ComputedRef } from "vue";
import type { PlaybackState } from "../../../../main/types";

interface ManualSeekBaseline {
  time: number;
  setAt: number;
  rate: number;
}

export function usePlaybackPrediction(playback: ComputedRef<PlaybackState | null | undefined>) {
  const manualSeekBaseline = ref<ManualSeekBaseline | null>(null);
  const predictedTime = ref<number | null>(null);
  let predictionFrame: number | null = null;

  const activeRate = computed(() => manualSeekBaseline.value?.rate ?? playback.value?.playbackRate ?? 0);

  function computePredictedTime(now = Date.now()): number | null {
    const state = playback.value;
    const manual = manualSeekBaseline.value;
    const rate = activeRate.value;

    if (manual) {
      const elapsed = Math.max(0, now - manual.setAt);
      return manual.time + elapsed * rate;
    }

    if (!state || state.currentTime === undefined || state.currentTime === null) {
      return null;
    }

    if (!state.lastUpdate || rate === 0) {
      return state.currentTime;
    }

    const elapsed = Math.max(0, now - state.lastUpdate);
    return state.currentTime + elapsed * rate;
  }

  function stopPredictionLoop() {
    if (predictionFrame !== null) {
      cancelAnimationFrame(predictionFrame);
      predictionFrame = null;
    }
  }

  function stepPrediction() {
    predictedTime.value = computePredictedTime();
    const rate = activeRate.value;
    if (rate && rate !== 0) {
      predictionFrame = requestAnimationFrame(stepPrediction);
    } else {
      predictionFrame = null;
    }
  }

  function startPredictionLoop() {
    stopPredictionLoop();
    predictedTime.value = computePredictedTime();
    const rate = activeRate.value;
    if (rate && rate !== 0) {
      predictionFrame = requestAnimationFrame(stepPrediction);
    }
  }

  function setManualSeekBaseline(time: number, rate?: number) {
    manualSeekBaseline.value = {
      time,
      setAt: Date.now(),
      rate: rate ?? playback.value?.playbackRate ?? 0
    };
    predictedTime.value = time;
    startPredictionLoop();
  }

  function clearManualSeekBaseline() {
    manualSeekBaseline.value = null;
  }

  watch(
    playback,
    () => {
      clearManualSeekBaseline();
      startPredictionLoop();
      onWatcherCleanup(() => {
        stopPredictionLoop();
      });
    },
    { immediate: true }
  );

  return {
    activeRate,
    manualSeekBaseline,
    predictedTime,
    computePredictedTime,
    setManualSeekBaseline,
    clearManualSeekBaseline,
    startPredictionLoop,
    stopPredictionLoop
  };
}
