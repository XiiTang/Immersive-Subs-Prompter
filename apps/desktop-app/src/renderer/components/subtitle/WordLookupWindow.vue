<template>
  <main
    class="word-lookup-window"
    data-testid="word-lookup-floating-panel"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
  >
    <UiSurface
      as="section"
      variant="floating"
      :padded="false"
      class="word-lookup-window__surface"
      data-testid="word-lookup-surface"
    >
      <div
        ref="scrollArea"
        class="word-lookup-window__content-clip"
        data-testid="word-lookup-scroll-area"
        @scroll="handleScroll"
        @pointerenter="handleScrollAreaPointerEnter"
        @wheel="handleScrollAreaActivity"
      >
        <div class="word-lookup-window__content">
          <UiEmptyState v-if="!matches.length" message="No matches" />
          <article
            v-for="match in matches"
            :key="`${match.fileOrder}-${match.word}`"
            class="word-lookup-entry"
          >
            <header class="word-lookup-entry__header">
              <span class="word-lookup-entry__word">{{ match.word }}</span>
              <span v-if="match.aliases.length" class="word-lookup-entry__aliases">{{ match.aliases.join(", ") }}</span>
            </header>
            <div
              class="word-lookup-entry__body"
              v-html="renderWordLookupMarkdown(match.content)"
              @click="handleContentClick"
            />
          </article>
        </div>
      </div>
      <div
        v-show="scrollbarScrollable"
        class="word-lookup-scrollbar ui-scrollbar"
        :class="{ 'word-lookup-scrollbar--visible': scrollbarVisible }"
        data-testid="word-lookup-scrollbar"
        @pointerenter="handleScrollAreaActivity"
      >
        <div
          class="word-lookup-scrollbar__thumb"
          data-testid="word-lookup-scrollbar-thumb"
          :style="scrollbarThumbStyle"
          @pointerdown="beginScrollbarDrag"
        />
      </div>
      <UiIconButton
        class="word-lookup-resize-handle ui-resize-handle"
        label="调整单词面板尺寸"
        data-testid="word-lookup-resize-handle"
        @pointerdown="beginResizeDrag"
      >
        <span aria-hidden="true" />
      </UiIconButton>
    </UiSurface>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { renderWordLookupMarkdown } from "../../plugins/wordLookupMarkdown";
import type { WordLookupResult } from "../../plugins/wordLookupTypes";
import { clamp } from "../../utils/formatters";
import { UiEmptyState, UiIconButton, UiSurface } from "../ui";

type WordLookupWindowPayload = {
  matches: WordLookupResult["matches"];
};

const matches = ref<WordLookupResult["matches"]>([]);
const scrollArea = ref<HTMLElement | null>(null);
const scrollbarScrollable = ref(false);
const scrollbarVisible = ref(false);
const scrollbarThumbHeight = ref(24);
const scrollbarThumbTop = ref(8);
const isScrollbarDragging = ref(false);
const isResizeDragging = ref(false);
let unsubscribePayload: (() => void) | null = null;
let resizeDragRafId: number | null = null;
let pendingResizeDragSize: { width: number; height: number } | null = null;
let scrollbarHideTimer: number | null = null;
let resizeObserver: ResizeObserver | null = null;

type ScrollbarDragState = {
  pointerId: number;
  startY: number;
  startScrollTop: number;
  maxScrollTop: number;
  trackScrollableRange: number;
};

type ResizeDragState = {
  pointerId: number;
  startScreenX: number;
  startScreenY: number;
  startWidth: number;
  startHeight: number;
};

let scrollbarDragState: ScrollbarDragState | null = null;
let resizeDragState: ResizeDragState | null = null;

const SCROLLBAR_EDGE_INSET = 8;
const SCROLLBAR_MIN_THUMB_HEIGHT = 24;
const SCROLLBAR_HIDE_DELAY_MS = 900;
const MIN_PANEL_WIDTH = 260;
const MIN_PANEL_HEIGHT = 180;

const scrollbarThumbStyle = computed(() => ({
  height: `${scrollbarThumbHeight.value}px`,
  transform: `translateY(${scrollbarThumbTop.value}px)`
}));

function handlePayload(payload: WordLookupWindowPayload) {
  matches.value = Array.isArray(payload.matches) ? payload.matches : [];
  void nextTick(() => {
    updateScrollbarMetrics();
  });
}

function handlePointerEnter() {
  void window.usp.notifyWordLookupWindowPointerEnter();
}

function handlePointerLeave() {
  if (isResizeDragging.value || isScrollbarDragging.value) {
    return;
  }
  void window.usp.notifyWordLookupWindowPointerLeave();
}

function handleContentClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target.closest("a") : null;
  if (!target) return;
  event.preventDefault();
  const href = target.getAttribute("href");
  if (href) {
    void window.usp.openExternal(href);
  }
}

function updateScrollbarMetrics() {
  const area = scrollArea.value;
  if (!area || area.clientHeight <= 0 || area.scrollHeight <= area.clientHeight) {
    scrollbarScrollable.value = false;
    scrollbarVisible.value = false;
    return;
  }

  const trackHeight = Math.max(0, area.clientHeight - SCROLLBAR_EDGE_INSET * 2);
  const maxScrollTop = Math.max(1, area.scrollHeight - area.clientHeight);
  const thumbHeight = clamp(
    Math.round((area.clientHeight / area.scrollHeight) * trackHeight),
    Math.min(SCROLLBAR_MIN_THUMB_HEIGHT, trackHeight),
    trackHeight
  );
  const trackScrollableRange = Math.max(0, trackHeight - thumbHeight);

  scrollbarScrollable.value = true;
  scrollbarThumbHeight.value = thumbHeight;
  scrollbarThumbTop.value = Math.round(
    SCROLLBAR_EDGE_INSET + (area.scrollTop / maxScrollTop) * trackScrollableRange
  );
}

function clearScrollbarHideTimer() {
  if (scrollbarHideTimer !== null) {
    window.clearTimeout(scrollbarHideTimer);
    scrollbarHideTimer = null;
  }
}

function showScrollbar(options: { persist?: boolean } = {}) {
  updateScrollbarMetrics();
  if (!scrollbarScrollable.value) {
    return;
  }
  scrollbarVisible.value = true;
  clearScrollbarHideTimer();
  if (options.persist || isScrollbarDragging.value) {
    return;
  }
  scrollbarHideTimer = window.setTimeout(() => {
    scrollbarVisible.value = false;
    scrollbarHideTimer = null;
  }, SCROLLBAR_HIDE_DELAY_MS);
}

function handleScroll() {
  showScrollbar();
}

function handleScrollAreaPointerEnter() {
  showScrollbar();
}

function handleScrollAreaActivity() {
  showScrollbar();
}

function beginScrollbarDrag(event: PointerEvent) {
  const area = scrollArea.value;
  if (!area || !scrollbarScrollable.value) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  updateScrollbarMetrics();
  const trackHeight = Math.max(0, area.clientHeight - SCROLLBAR_EDGE_INSET * 2);
  scrollbarDragState = {
    pointerId: event.pointerId,
    startY: event.clientY,
    startScrollTop: area.scrollTop,
    maxScrollTop: Math.max(1, area.scrollHeight - area.clientHeight),
    trackScrollableRange: Math.max(1, trackHeight - scrollbarThumbHeight.value)
  };
  isScrollbarDragging.value = true;
  showScrollbar({ persist: true });
  window.addEventListener("pointermove", handleScrollbarDragMove);
  window.addEventListener("pointerup", finishScrollbarDrag);
  window.addEventListener("pointercancel", finishScrollbarDrag);
}

function handleScrollbarDragMove(event: PointerEvent) {
  if (!scrollbarDragState || event.pointerId !== scrollbarDragState.pointerId) {
    return;
  }
  const area = scrollArea.value;
  if (!area) {
    return;
  }
  const scrollDelta = ((event.clientY - scrollbarDragState.startY) / scrollbarDragState.trackScrollableRange)
    * scrollbarDragState.maxScrollTop;
  area.scrollTop = clamp(
    scrollbarDragState.startScrollTop + scrollDelta,
    0,
    scrollbarDragState.maxScrollTop
  );
  updateScrollbarMetrics();
}

function finishScrollbarDrag(event?: PointerEvent) {
  if (event && scrollbarDragState && event.pointerId !== scrollbarDragState.pointerId) {
    return;
  }
  scrollbarDragState = null;
  isScrollbarDragging.value = false;
  window.removeEventListener("pointermove", handleScrollbarDragMove);
  window.removeEventListener("pointerup", finishScrollbarDrag);
  window.removeEventListener("pointercancel", finishScrollbarDrag);
  showScrollbar();
}

function beginResizeDrag(event: PointerEvent) {
  event.preventDefault();
  event.stopPropagation();
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
  resizeDragState = {
    pointerId: event.pointerId,
    startScreenX: event.screenX,
    startScreenY: event.screenY,
    startWidth: window.innerWidth,
    startHeight: window.innerHeight
  };
  isResizeDragging.value = true;
  window.addEventListener("pointermove", handleResizeDragMove);
  window.addEventListener("pointerup", finishResizeDrag);
  window.addEventListener("pointercancel", finishResizeDrag);
}

function handleResizeDragMove(event: PointerEvent) {
  if (!resizeDragState || event.pointerId !== resizeDragState.pointerId) {
    return;
  }
  const width = Math.max(
    MIN_PANEL_WIDTH,
    Math.round(resizeDragState.startWidth + event.screenX - resizeDragState.startScreenX)
  );
  const height = Math.max(
    MIN_PANEL_HEIGHT,
    Math.round(resizeDragState.startHeight + event.screenY - resizeDragState.startScreenY)
  );
  queueResizeWindow({ width, height });
}

function queueResizeWindow(size: { width: number; height: number }) {
  pendingResizeDragSize = size;
  if (resizeDragRafId !== null) {
    return;
  }
  resizeDragRafId = window.requestAnimationFrame(flushResizeWindow);
}

function flushResizeWindow() {
  if (resizeDragRafId !== null) {
    window.cancelAnimationFrame(resizeDragRafId);
    resizeDragRafId = null;
  }
  const size = pendingResizeDragSize;
  pendingResizeDragSize = null;
  if (size) {
    void window.usp.resizeWordLookupWindow(size);
  }
}

function finishResizeDrag(event?: PointerEvent) {
  if (event && resizeDragState && event.pointerId !== resizeDragState.pointerId) {
    return;
  }
  resizeDragState = null;
  isResizeDragging.value = false;
  window.removeEventListener("pointermove", handleResizeDragMove);
  window.removeEventListener("pointerup", finishResizeDrag);
  window.removeEventListener("pointercancel", finishResizeDrag);
  flushResizeWindow();
}

onMounted(() => {
  unsubscribePayload = window.usp.onWordLookupWindowPayload(handlePayload);
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(() => {
      updateScrollbarMetrics();
    });
    if (scrollArea.value) {
      resizeObserver.observe(scrollArea.value);
    }
  }
});

onBeforeUnmount(() => {
  unsubscribePayload?.();
  resizeObserver?.disconnect();
  resizeObserver = null;
  finishScrollbarDrag();
  finishResizeDrag();
  clearScrollbarHideTimer();
  flushResizeWindow();
});
</script>
