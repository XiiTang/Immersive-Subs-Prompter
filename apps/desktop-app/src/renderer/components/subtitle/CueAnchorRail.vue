<template>
  <div
    class="transcript-block__cue-actions"
    :data-meta-state="state"
    data-testid="transcript-cue-actions"
  >
    <span class="transcript-block__cue-time">{{ timeLabel }}</span>
    <button
      class="transcript-block__play-btn"
      :aria-label="playLabel"
      data-testid="cue-action-play"
      type="button"
      @click.stop="$emit('play')"
    >
      ▶
    </button>
    <button
      class="transcript-block__ab-btn"
      :class="{
        'transcript-block__ab-btn--active': abLabel === 'A',
        'transcript-block__ab-btn--pending-end': abLabel === 'B'
      }"
      :aria-label="abLoopLabel"
      data-testid="cue-action-ab"
      type="button"
      @click.stop="$emit('loop-range')"
    >
      {{ abLabel }}
    </button>
    <button
      class="transcript-block__loop-btn"
      :class="{ 'transcript-block__loop-btn--active': isLooping }"
      :aria-label="loopLabel"
      :aria-pressed="isLooping"
      data-testid="cue-action-loop"
      type="button"
      @click.stop="$emit('loop')"
    >
      ↻
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { resolveSubtitleTranslate, type SubtitleTranslate } from "./transcript/translate";
import { formatTime } from "../../utils/formatters";

const {
  start,
  end,
  abLabel,
  isLooping,
  isAbPendingSelection,
  t: translateProp
} = defineProps<{
  state: "quiet" | "hover" | "active" | "selection" | "looping" | "ab-pending" | "focus-within";
  start: number;
  end: number;
  abLabel: "AB" | "A" | "B";
  isLooping: boolean;
  isAbPendingSelection: boolean;
  t?: SubtitleTranslate;
}>();

const translate = resolveSubtitleTranslate(translateProp);

defineEmits<{
  (e: "play"): void;
  (e: "loop"): void;
  (e: "loop-range"): void;
}>();

const timeLabel = computed(() => `${formatTime(start)} - ${formatTime(end)}`);
const playLabel = computed(() => translate("cue-play-label", { time: timeLabel.value }));
const loopLabel = computed(() => translate("cue-loop-label", { time: timeLabel.value }));
const abLoopLabel = computed(() => {
  if (isAbPendingSelection) {
    return translate("cue-ab-pending-label", { time: timeLabel.value });
  }
  if (abLabel === "A") {
    return translate("cue-ab-a-label", { time: timeLabel.value });
  }
  if (abLabel === "B") {
    return translate("cue-ab-b-label", { time: timeLabel.value });
  }
  return translate("cue-ab-set-label", { time: timeLabel.value });
});
</script>
