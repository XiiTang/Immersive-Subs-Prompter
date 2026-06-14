<template>
  <UiToolbar
    class="transcript-block__cue-actions"
    :data-meta-state="state"
    data-testid="transcript-cue-actions"
    :label="timeLabel"
    density="compact"
  >
    <span class="transcript-block__cue-time">{{ timeLabel }}</span>
    <UiIconButton
      :label="playLabel"
      data-testid="cue-action-play"
      size="xs"
      @click.stop="handleActionClick($event, 'play')"
    >
      <IconPlay size="sm" />
    </UiIconButton>
    <UiIconButton
      :label="abLoopLabel"
      data-testid="cue-action-ab"
      size="xs"
      :active="abLabel === 'A' || abLabel === 'B'"
      :pressed="abLabel === 'A' || abLabel === 'B'"
      @click.stop="handleActionClick($event, 'loop-range')"
    >
      <span class="transcript-block__cue-action-text">{{ abLabel }}</span>
    </UiIconButton>
    <UiIconButton
      :label="loopLabel"
      data-testid="cue-action-loop"
      size="xs"
      :active="isLooping"
      :pressed="isLooping"
      @click.stop="handleActionClick($event, 'loop')"
    >
      <span class="transcript-block__cue-action-text">↻</span>
    </UiIconButton>
  </UiToolbar>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { SubtitleTranslate } from "./transcript/translate";
import { formatTime } from "../../utils/formatters";
import { IconPlay } from "../icons";
import { UiIconButton, UiToolbar } from "../ui";

const {
  start,
  end,
  abLabel,
  isLooping,
  isAbPendingSelection,
  t: translate
} = defineProps<{
  state: "quiet" | "hover" | "active" | "selection" | "looping" | "ab-pending" | "focus-within";
  start: number;
  end: number;
  abLabel: "AB" | "A" | "B";
  isLooping: boolean;
  isAbPendingSelection: boolean;
  t: SubtitleTranslate;
}>();

const emit = defineEmits<{
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

type CueAction = "play" | "loop" | "loop-range";

function handleActionClick(event: MouseEvent, action: CueAction) {
  if (event.detail > 0 && event.currentTarget instanceof HTMLButtonElement) {
    event.currentTarget.blur();
  }

  if (action === "play") {
    emit("play");
    return;
  }
  if (action === "loop") {
    emit("loop");
    return;
  }
  emit("loop-range");
}
</script>
