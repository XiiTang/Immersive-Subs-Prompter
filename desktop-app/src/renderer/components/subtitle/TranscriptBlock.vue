<template>
  <article
    class="transcript-block"
    :class="{ 'transcript-block--active': isActive, 'transcript-block--looping': isSingleLooping }"
    :data-transcript-block-id="blockId"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @focusin="focusedWithin = true"
    @focusout="focusedWithin = false"
    @click="$emit('play')"
  >
    <div class="transcript-block__body" data-testid="transcript-block-body">
      <div
        class="transcript-block__meta-row"
        :data-auto-hide-quiet="autoHideMetaRow"
        :data-meta-state="metaRowState"
        data-testid="transcript-meta-row"
      >
        <CueAnchorRail
          :state="metaRowState"
          :start="start"
          :end="end"
          :ab-label="abLabel"
          :is-looping="isSingleLooping"
          :is-ab-pending-selection="isAbPendingSelection"
          @play="$emit('play')"
          @loop="$emit('loop')"
          @loop-range="$emit('loop-range')"
        />
      </div>
      <div class="transcript-block__text">
        <div
          v-for="line in lines"
          :key="line.key"
          class="transcript-block__line"
          :class="`transcript-block__line--${line.kind}`"
          :style="line.style"
        >
          {{ line.text }}
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import CueAnchorRail from "./CueAnchorRail.vue";
import type { TranscriptLayoutLineKind } from "./transcript/types";

const props = defineProps<{
  blockId: string;
  start: number;
  end: number;
  lines: Array<{ key: string; kind: TranscriptLayoutLineKind; text: string; style: Record<string, string> }>;
  autoHideMetaRow: boolean;
  isActive: boolean;
  isSingleLooping: boolean;
  abLabel: "AB" | "A" | "B";
  isAbPendingSelection: boolean;
  showSelectionActions: boolean;
}>();

defineEmits<{
  (e: "play"): void;
  (e: "loop"): void;
  (e: "loop-range"): void;
}>();

const hovered = ref(false);
const focusedWithin = ref(false);

const metaRowState = computed(() => {
  if (props.showSelectionActions) {
    return "selection";
  }
  if (focusedWithin.value) {
    return "focus-within";
  }
  if (props.isAbPendingSelection) {
    return "ab-pending";
  }
  if (props.isSingleLooping) {
    return "looping";
  }
  if (props.isActive) {
    return "active";
  }
  if (hovered.value) {
    return "hover";
  }
  return "quiet";
});
</script>
