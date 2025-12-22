import { ref } from "vue";
import type { ComputedRef } from "vue";
import { clamp } from "../../../utils/formatters";

interface UsePlaybackScrubbingOptions {
  sliderEnabled: ComputedRef<boolean>;
  sliderMax: ComputedRef<number>;
  onSeek: (time: number) => void;
}

export function usePlaybackScrubbing({ sliderEnabled, sliderMax, onSeek }: UsePlaybackScrubbingOptions) {
  const isScrubbing = ref(false);
  const scrubbedTime = ref<number | null>(null);

  function handleScrubStart() {
    if (!sliderEnabled.value) {
      return;
    }
    isScrubbing.value = true;
  }

  function handleScrubInput(event: Event) {
    if (!sliderEnabled.value) {
      return;
    }
    const target = event.target as HTMLInputElement | null;
    const rawValue = target ? Number(target.value) : NaN;
    if (!Number.isFinite(rawValue)) {
      return;
    }
    const clamped = clamp(rawValue, 0, sliderMax.value || 1);
    scrubbedTime.value = clamped;
    if (!isScrubbing.value) {
      isScrubbing.value = true;
    }
  }

  function handleScrubCancel() {
    isScrubbing.value = false;
    scrubbedTime.value = null;
  }

  function handleScrubEnd(event?: Event) {
    if (!sliderEnabled.value) {
      handleScrubCancel();
      return;
    }
    if (event) {
      handleScrubInput(event);
    }
    const time = scrubbedTime.value;
    isScrubbing.value = false;
    scrubbedTime.value = null;
    if (typeof time === "number" && Number.isFinite(time)) {
      onSeek(time);
    }
  }

  return {
    isScrubbing,
    scrubbedTime,
    handleScrubStart,
    handleScrubInput,
    handleScrubEnd,
    handleScrubCancel
  };
}
