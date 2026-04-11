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
          :auto-hide-meta-row="props.autoHideMetaRow"
          :is-active="block.block.id === projection.activeBlockId"
          :is-single-looping="singleLoopCueIndex === block.block.sourceCueRefs.primaryCueIndex"
          :ab-label="resolveAbLoopLabel(block.block.sourceCueRefs.primaryCueIndex)"
          :is-ab-pending-selection="isAbPendingSelection(block.block.sourceCueRefs.primaryCueIndex)"
          :show-selection-actions="isSelectionPaused && block.block.id === projection.activeBlockId"
          @play="emit('play-cue', block.block.sourceCueRefs.primaryCueIndex)"
          @loop="emit('loop-cue', block.block.sourceCueRefs.primaryCueIndex)"
          @loop-range="emit('loop-range', block.block.sourceCueRefs.primaryCueIndex)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { LoopSession } from "../../../main/types.js";
import type { AbLoopSelectionState } from "./abLoopSelection";
import { getAbLoopLabel } from "./abLoopSelection";
import TranscriptBlock from "./TranscriptBlock.vue";
import { useTranscriptAutoFollow } from "./composables/useTranscriptAutoFollow";
import { useTranscriptSelection } from "./composables/useTranscriptSelection";
import { getLoopWrapCueIndex, getSingleLoopCueIndex } from "./loopPlayback";
import { createTranscriptPreparedTextCache, layoutTranscriptBlocks } from "./transcript/pretextLayout";
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

const props = withDefaults(defineProps<{
  blocks: TranscriptBlockModel[];
  currentTime: number | null;
  seekRequest?: TranscriptSeekRequest | null;
  playbackLoop: LoopSession | null;
  abLoopSelectionState: AbLoopSelectionState;
  subtitlePanelStyle: Record<string, string>;
  fontFamily: string;
  fontSize: number;
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
}>(), {
  autoHideMetaRow: false,
  seekRequest: null
});

const emit = defineEmits<{
  (e: "play-cue", cueIndex: number): void;
  (e: "loop-cue", cueIndex: number): void;
  (e: "loop-range", cueIndex: number): void;
}>();

const viewportRef = ref<HTMLElement | null>(null);
const contentRef = ref<HTMLElement | null>(null);
const surfaceWidth = ref(640);
const viewportHeight = ref(1);
const viewportScrollTop = ref(0);
const lastAnchor = ref<TranscriptViewportAnchor | null>(null);
const preparedTextCache = createTranscriptPreparedTextCache();
const WINDOW_OVERSCAN_PX = 240;
const META_ROW_HEIGHT_PX = 18;
const META_ROW_GAP_PX = 6;
let scrollRafId: number | null = null;

const surfaceStyle = computed(() => props.subtitlePanelStyle);
const contentStyle = computed(() => ({
  height: `${layout.value.totalHeight}px`
}));

const layout = computed(() =>
  layoutTranscriptBlocks({
    blocks: props.blocks,
    width: surfaceWidth.value,
    fontSize: props.fontSize,
    lineHeight: props.lineHeight,
    fontFamily: props.fontFamily,
    primarySecondaryGap: props.primarySecondaryGap,
    blockGap: props.blockGap,
    metaRowHeight: META_ROW_HEIGHT_PX,
    metaRowGap: META_ROW_GAP_PX,
    preparedTextCache
  })
);

const blockById = computed(() => new Map(props.blocks.map((block) => [block.id, block])));
const blockIdByCueIndex = computed(() => new Map(props.blocks.map((block) => [block.sourceCueRefs.primaryCueIndex, block.id])));
const singleLoopCueIndex = computed(() => getSingleLoopCueIndex(props.playbackLoop));
const playbackActiveBlockId = computed(() => {
  if (props.currentTime === null) return null;
  const index = findActiveBlockIndex(layout.value.blocks, props.currentTime);
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
  const cueIndex = getLoopWrapCueIndex(props.playbackLoop);
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
  () => [props.blocks, props.fontFamily, props.fontSize],
  () => {
    preparedTextCache.clear();
  }
);

watch(
  [followAnchor, () => props.blocks],
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
    followRatio: props.scrollPositionRatio
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

const secondaryFontSize = computed(() => Math.max(props.fontSize - 1, 1));

const renderedBlocks = computed(() => {
  const activeBlockId = projection.value.activeBlockId;
  const layoutResult = layout.value;
  return layoutResult.blocks
    .slice(windowProjection.value.startIndex, windowProjection.value.endIndex)
    .map((layoutBlock) => {
      const block = blockById.value.get(layoutBlock.blockId)!;
      const isActive = block.id === activeBlockId;
      const lines = layoutResult.lines
        .slice(layoutBlock.lineStart, layoutBlock.lineStart + layoutBlock.lineCount)
        .map((line) => ({
          key: line.key,
          kind: line.kind,
          text: line.text,
          style: {
            top: `${line.relativeTop}px`,
            height: `${line.height}px`,
            lineHeight: `${line.height}px`,
            fontFamily: props.fontFamily,
            fontSize: `${line.kind === "primary" ? props.fontSize : secondaryFontSize.value}px`,
            color: line.kind === "primary"
              ? (isActive ? props.activePrimaryColor : props.primaryColor)
              : (isActive ? props.activeSecondaryColor : props.secondaryColor)
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
  return getAbLoopLabel(props.abLoopSelectionState, cueIndex);
}

function isAbPendingSelection(cueIndex: number) {
  return props.abLoopSelectionState.kind === "selecting-second" && props.abLoopSelectionState.anchorCueIndex === cueIndex;
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
  autoScrollDelayMs: computed(() => props.autoScrollDelayMs),
  onResume: () => {
    syncViewportMetrics();
    lastAnchor.value = resolveTranscriptViewportAnchor({
      layout: layout.value,
      currentTime: props.currentTime,
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
  targetScrollTop: computed(() => projection.value.targetScrollTop)
});

watch(
  () => props.seekRequest?.token,
  () => {
    if (!props.seekRequest) {
      return;
    }

    syncViewportMetrics();
    clearAutoFollowPause();
    lastAnchor.value = resolveTranscriptViewportAnchor({
      layout: layout.value,
      currentTime: props.seekRequest.time,
      previousAnchor: null,
      reason: "seek-recenter"
    });
    scrollToProjectedPosition("auto");
  }
);

function handleResize() {
  syncViewportMetrics();
  lastAnchor.value = resolveTranscriptViewportAnchor({
    layout: layout.value,
    currentTime: props.currentTime,
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
