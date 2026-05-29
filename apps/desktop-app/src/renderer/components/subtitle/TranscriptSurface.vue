<template>
  <section
    class="transcript-surface"
    :style="surfaceStyle"
    data-testid="transcript-surface"
    :data-selection-paused="isSelectionPaused"
  >
    <div class="transcript-surface__viewport" ref="viewportRef" @scroll="handleViewportScroll">
      <div class="transcript-surface__content" ref="contentRef" :style="contentStyle">
        <TranscriptBlock
          v-for="block in renderedBlocks"
          :key="block.block.id"
          :style="block.style"
          :block-id="block.block.id"
          :start="block.block.start"
          :end="block.block.end"
          :lines="block.lines"
          :meta-row-height="metadataSizing.metaRowHeight"
          :timestamp-font-size="metadataSizing.timestampFontSize"
          :action-font-size="metadataSizing.actionFontSize"
          :auto-hide-meta-row="autoHideMetaRow"
          :is-active="block.block.id === projection.activeBlockId"
          :is-single-looping="singleLoopCueIndex === block.block.sourceCueRefs.primaryCueIndex"
          :ab-label="resolveAbLoopLabel(block.block.sourceCueRefs.primaryCueIndex)"
          :is-ab-pending-selection="isAbPendingSelection(block.block.sourceCueRefs.primaryCueIndex)"
          :show-selection-actions="isSelectionPaused && block.block.id === projection.activeBlockId"
          :t="translate"
          @play="emit('play-cue', block.block.sourceCueRefs.primaryCueIndex)"
          @loop="emit('loop-cue', block.block.sourceCueRefs.primaryCueIndex)"
          @loop-range="emit('loop-range', block.block.sourceCueRefs.primaryCueIndex)"
          @word-hover="emit('word-hover', $event)"
          @word-leave="emit('word-leave', $event)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import type { LoopSnapshot } from "@immersive-subs/contracts";
import type { AbLoopSelectionState } from "./abLoopSelection";
import { getAbLoopLabel } from "./abLoopSelection";
import TranscriptBlock from "./TranscriptBlock.vue";
import { useTranscriptAutoFollow } from "./composables/useTranscriptAutoFollow";
import { useTranscriptSelection } from "./composables/useTranscriptSelection";
import { getLoopWrapCueIndex, getSingleLoopCueIndex } from "./loopPlayback";
import {
  createTranscriptPreparedTextCache,
  materializeTranscriptBlockLines,
  measureTranscriptLayout
} from "./transcript/pretextLayout";
import { projectTranscriptWindow } from "./transcript/projectTranscriptWindow";
import {
  findActiveBlockIndex,
  projectTranscriptViewport,
  resolveTranscriptViewportAnchor
} from "./transcript/projectTranscriptViewport";
import type {
  TranscriptBlock as TranscriptBlockModel,
  TranscriptSeekRequest,
  TranscriptViewportAnchor
} from "./transcript/types";
import { resolveSubtitleTranslate, type SubtitleTranslate } from "./transcript/translate";
import type { WordHoverPayload, WordLeavePayload } from "../../plugins/wordLookupTypes";

const {
  blocks,
  currentTime,
  seekRequest = null,
  playbackLoop,
  abLoopSelectionState,
  subtitlePanelStyle,
  primaryFontFamily,
  primaryFontSize,
  secondaryFontFamily,
  secondaryFontSize,
  timestampFontSize = 11,
  autoHideMetaRow = false,
  lineHeight,
  primarySecondaryGap,
  blockGap,
  primaryColor,
  secondaryColor,
  activePrimaryColor,
  activeSecondaryColor,
  autoScrollDelayMs,
  scrollPositionRatio,
  autoFollowScrollBehavior = "smooth",
  t: translateProp
} = defineProps<{
  blocks: TranscriptBlockModel[];
  currentTime: number | null;
  seekRequest?: TranscriptSeekRequest | null;
  playbackLoop: LoopSnapshot | null;
  abLoopSelectionState: AbLoopSelectionState;
  subtitlePanelStyle: Record<string, string>;
  primaryFontFamily: string;
  primaryFontSize: number;
  secondaryFontFamily: string;
  secondaryFontSize: number;
  timestampFontSize?: number;
  autoHideMetaRow?: boolean;
  lineHeight: number;
  primarySecondaryGap: number;
  blockGap: number;
  primaryColor: string;
  secondaryColor: string;
  activePrimaryColor: string;
  activeSecondaryColor: string;
  autoScrollDelayMs: number;
  scrollPositionRatio: number;
  autoFollowScrollBehavior?: ScrollBehavior;
  t?: SubtitleTranslate;
}>();

const translate = resolveSubtitleTranslate(translateProp);

const emit = defineEmits<{
  (e: "play-cue", cueIndex: number): void;
  (e: "loop-cue", cueIndex: number): void;
  (e: "loop-range", cueIndex: number): void;
  (e: "word-hover", payload: WordHoverPayload): void;
  (e: "word-leave", payload: WordLeavePayload): void;
}>();

const viewportRef = useTemplateRef<HTMLElement>("viewportRef");
const contentRef = useTemplateRef<HTMLElement>("contentRef");
const surfaceWidth = ref(640);
const viewportHeight = ref(1);
const viewportScrollTop = ref(0);
const lastAnchor = ref<TranscriptViewportAnchor | null>(null);
const suppressNextAutoFollowScroll = ref(false);
const preparedTextCache = createTranscriptPreparedTextCache();
const WINDOW_OVERSCAN_PX = 240;
const META_ROW_HEIGHT_PX = 18;
let scrollRafId: number | null = null;

const surfaceStyle = computed(() => subtitlePanelStyle);
const metadataSizing = computed(() => {
  const safeTimestampFontSize = normalizeTimestampFontSize(timestampFontSize);
  return {
    timestampFontSize: safeTimestampFontSize,
    metaRowHeight: Math.max(META_ROW_HEIGHT_PX, safeTimestampFontSize + 7),
    actionFontSize: Math.max(12, Math.round(safeTimestampFontSize * 1.1))
  };
});
const contentStyle = computed(() => ({
  height: `${layout.value.totalHeight + projection.value.scrollPaddingBottom}px`
}));

const layout = computed(() =>
  measureTranscriptLayout({
    blocks,
    width: surfaceWidth.value,
    primaryFontSize,
    secondaryFontSize,
    lineHeight,
    primaryFontFamily,
    secondaryFontFamily,
    primarySecondaryGap,
    blockGap,
    metaRowHeight: metadataSizing.value.metaRowHeight,
    preparedTextCache
  })
);

const blockById = computed(() => new Map(blocks.map((block) => [block.id, block])));
const blockIdByCueIndex = computed(() => new Map(blocks.map((block) => [block.sourceCueRefs.primaryCueIndex, block.id])));
const singleLoopCueIndex = computed(() => getSingleLoopCueIndex(playbackLoop));
const playbackActiveBlockId = computed(() => {
  if (currentTime === null) return null;
  const index = findActiveBlockIndex(layout.value.blocks, currentTime);
  return index === -1 ? null : layout.value.blocks[index]!.blockId;
});
const playbackFollowAnchor = computed<TranscriptViewportAnchor | null>(() => {
  const blockId = playbackActiveBlockId.value;
  if (!blockId) {
    return null;
  }
  return {
    blockId,
    reason: "playback-follow",
    anchorBias: 0.5
  };
});
const loopWrapFollowAnchor = computed<TranscriptViewportAnchor | null>(() => {
  const cueIndex = getLoopWrapCueIndex(playbackLoop);
  if (cueIndex === null) {
    return null;
  }

  const blockId = blockIdByCueIndex.value.get(cueIndex);
  if (!blockId) {
    return null;
  }

  return {
    blockId,
    reason: "loop-wrap-follow",
    anchorBias: 0.5
  };
});
const followAnchor = computed(() => loopWrapFollowAnchor.value ?? playbackFollowAnchor.value);

watch(
  () => [blocks, primaryFontFamily, primaryFontSize, secondaryFontFamily, secondaryFontSize],
  () => {
    preparedTextCache.clear();
  },
  { flush: "sync" }
);

watch(
  [followAnchor, () => blocks],
  ([anchor]) => {
    lastAnchor.value = anchor;
  },
  { immediate: true }
);

const projection = computed(() =>
  projectTranscriptViewport({
    layout: layout.value,
    anchor: lastAnchor.value,
    activeBlockId: playbackActiveBlockId.value,
    viewportHeight: viewportHeight.value,
    followRatio: scrollPositionRatio
  })
);

const windowProjection = computed(() =>
  projectTranscriptWindow({
    layout: layout.value,
    scrollTop: viewportScrollTop.value,
    viewportHeight: viewportHeight.value,
    overscanPx: WINDOW_OVERSCAN_PX
  })
);

const renderedBlocks = computed(() => {
  const activeBlockId = projection.value.activeBlockId;
  const layoutResult = layout.value;
  return layoutResult.blocks
    .slice(windowProjection.value.startIndex, windowProjection.value.endIndex)
    .map((layoutBlock) => {
      const block = blockById.value.get(layoutBlock.blockId)!;
      const isActive = block.id === activeBlockId;
      const lines = materializeTranscriptBlockLines({
        block: layoutBlock,
        width: surfaceWidth.value,
        preparedTextCache
      })
        .map((line) => ({
          key: line.key,
          kind: line.kind,
          text: line.text,
          style: {
            top: `${line.relativeTop}px`,
            height: `${line.height}px`,
            lineHeight: `${line.height}px`,
            fontFamily: line.kind === "primary" ? primaryFontFamily : secondaryFontFamily,
            fontSize: `${line.kind === "primary" ? primaryFontSize : secondaryFontSize}px`,
            color: line.kind === "primary"
              ? (isActive ? activePrimaryColor : primaryColor)
              : (isActive ? activeSecondaryColor : secondaryColor)
          }
        }));
      return {
        block,
        style: {
          top: `${layoutBlock.top}px`,
          height: `${layoutBlock.height}px`
        },
        lines
      };
    });
});

function resolveAbLoopLabel(cueIndex: number) {
  return getAbLoopLabel(abLoopSelectionState, cueIndex);
}

function isAbPendingSelection(cueIndex: number) {
  return abLoopSelectionState.kind === "selecting-second" && abLoopSelectionState.anchorCueIndex === cueIndex;
}

function normalizeTimestampFontSize(value: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 11;
  }
  return Math.min(24, Math.max(6, Math.round(numeric)));
}

function handleViewportScroll() {
  if (scrollRafId !== null) {
    return;
  }
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null;
    const viewport = viewportRef.value;
    if (!viewport) {
      return;
    }
    viewportScrollTop.value = viewport.scrollTop;
  });
}

function syncViewportMetrics() {
  const content = contentRef.value;
  if (content && content.clientWidth > 0) {
    surfaceWidth.value = content.clientWidth;
  }

  const viewport = viewportRef.value;
  if (viewport && viewport.clientHeight > 0) {
    viewportHeight.value = viewport.clientHeight;
    viewportScrollTop.value = viewport.scrollTop;
  }
}

const { isSelectionPaused, isAutoFollowPaused, clearAutoFollowPause } = useTranscriptSelection({
  rootEl: viewportRef,
  autoScrollDelayMs: computed(() => autoScrollDelayMs),
  onResume: () => {
    syncViewportMetrics();
    lastAnchor.value = resolveTranscriptViewportAnchor({
      layout: layout.value,
      currentTime,
      previousAnchor: playbackFollowAnchor.value,
      reason: "playback-follow"
    });
    scrollToProjectedPosition("smooth");
  }
});

const autoFollowEnabled = computed(() => !isAutoFollowPaused.value);
const { scrollToProjectedPosition } = useTranscriptAutoFollow({
  containerEl: viewportRef,
  enabled: autoFollowEnabled,
  targetScrollTop: computed(() => projection.value.targetScrollTop),
  suppressScheduledScroll: suppressNextAutoFollowScroll,
  followScrollBehavior: computed(() => autoFollowScrollBehavior)
});

watch(
  () => seekRequest?.token,
  () => {
    if (!seekRequest) {
      return;
    }

    syncViewportMetrics();
    clearAutoFollowPause();
    suppressNextAutoFollowScroll.value = true;
    lastAnchor.value = resolveTranscriptViewportAnchor({
      layout: layout.value,
      currentTime: seekRequest.time,
      previousAnchor: null,
      reason: "seek-recenter"
    });
    scrollToProjectedPosition("auto");
    nextTick(() => {
      suppressNextAutoFollowScroll.value = false;
    });
  }
);

function handleResize() {
  syncViewportMetrics();
  lastAnchor.value = resolveTranscriptViewportAnchor({
    layout: layout.value,
    currentTime,
    previousAnchor: playbackFollowAnchor.value,
    reason: "resize-reproject"
  });
  scrollToProjectedPosition("auto");
}

onMounted(() => {
  syncViewportMetrics();
  window.addEventListener("resize", handleResize);
  nextTick(() => {
    syncViewportMetrics();
    scrollToProjectedPosition("auto");
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", handleResize);
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId);
    scrollRafId = null;
  }
});

defineExpose({
  isSelectionPaused
});
</script>
