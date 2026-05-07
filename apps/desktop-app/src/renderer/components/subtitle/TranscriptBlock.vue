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
          <template v-for="part in tokenizeLineParts(line.text)" :key="part.key">
            <span
              v-if="part.token"
              class="word-lookup-token"
              data-testid="word-lookup-token"
              @mouseenter="handleTokenMouseEnter($event, part.text, line.key, part.key)"
              @mouseleave="emit('word-leave', { hoverId: createWordHoverId(line.key, part.key) })"
            >{{ part.text }}</span>
            <span v-else>{{ part.text }}</span>
          </template>
        </div>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import CueAnchorRail from "./CueAnchorRail.vue";
import type { TranscriptLayoutLineKind } from "./transcript/types";
import { tokenizeWordLookupText } from "../../plugins/wordLookupTokenize";
import type { WordHoverPayload, WordLeavePayload } from "../../plugins/wordLookupTypes";

const {
  blockId,
  showSelectionActions,
  isAbPendingSelection,
  isSingleLooping,
  isActive
} = defineProps<{
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

const emit = defineEmits<{
  (e: "play"): void;
  (e: "loop"): void;
  (e: "loop-range"): void;
  (e: "word-hover", payload: WordHoverPayload): void;
  (e: "word-leave", payload: WordLeavePayload): void;
}>();

const hovered = ref(false);
const focusedWithin = ref(false);

function tokenizeLineParts(text: string) {
  return tokenizeWordLookupText(text);
}

function createWordHoverId(lineKey: string, partKey: string) {
  return `${blockId}:${lineKey}:${partKey}`;
}

function handleTokenMouseEnter(event: MouseEvent, token: string, lineKey: string, partKey: string) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  emit("word-hover", {
    hoverId: createWordHoverId(lineKey, partKey),
    token,
    clientX: event.clientX,
    clientY: event.clientY,
    anchorRect: {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height
    },
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey
  });
}

const metaRowState = computed(() => {
  if (showSelectionActions) {
    return "selection";
  }
  if (focusedWithin.value) {
    return "focus-within";
  }
  if (isAbPendingSelection) {
    return "ab-pending";
  }
  if (isSingleLooping) {
    return "looping";
  }
  if (isActive) {
    return "active";
  }
  if (hovered.value) {
    return "hover";
  }
  return "quiet";
});
</script>
