<template>
  <aside
    ref="popoverRef"
    class="word-lookup-popover"
    :style="popoverStyle"
    role="dialog"
    aria-live="polite"
    @pointerdown.stop
  >
    <div
      ref="contentClipRef"
      class="word-lookup-popover__content-clip"
      @wheel="handleContentWheel"
      @mouseenter="showScrollbar"
      @mouseleave="hideScrollbarSoon"
    >
      <div
        ref="contentInnerRef"
        class="word-lookup-popover__content"
        :style="contentStyle"
      >
        <article v-for="match in matches" :key="`${match.fileOrder}-${match.word}`" class="word-lookup-entry">
          <header class="word-lookup-entry__header">
            <span class="word-lookup-entry__word">{{ match.word }}</span>
            <span v-if="match.aliases.length" class="word-lookup-entry__aliases">{{ match.aliases.join(", ") }}</span>
          </header>
          <div class="word-lookup-entry__body" v-html="renderWordLookupMarkdown(match.content)" @click="handleContentClick" />
        </article>
      </div>
      <div
        class="word-lookup-scrollbar"
        :class="{ 'word-lookup-scrollbar--visible': isScrollbarVisible }"
        @pointerdown.stop.prevent="handleScrollbarTrackPointerDown"
      >
        <div
          class="word-lookup-scrollbar__thumb"
          :style="scrollbarThumbStyle"
          @pointerdown.stop.prevent="handleScrollbarThumbPointerDown"
        />
      </div>
    </div>
    <button
      type="button"
      class="word-lookup-resize-handle"
      aria-label="Resize word lookup panel"
      @pointerdown.stop.prevent="handleResizePointerDown"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { renderWordLookupMarkdown } from "../../plugins/wordLookupMarkdown";
import type { WordLookupResult } from "../../plugins/wordLookupTypes";

interface WordAnchorRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const props = defineProps<{
  x: number;
  y: number;
  anchorRect: WordAnchorRect;
  width: number;
  height: number;
  matches: WordLookupResult["matches"];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "resize", size: { width: number; height: number }): void;
}>();

const popoverRef = ref<HTMLElement | null>(null);
const contentClipRef = ref<HTMLElement | null>(null);
const contentInnerRef = ref<HTMLElement | null>(null);
let measurementObserver: ResizeObserver | null = null;
let scrollbarHideTimer: number | null = null;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 180;
const POPOVER_MARGIN = 12;
const ANCHOR_GAP = 8;
const SCROLLBAR_VERTICAL_INSET = 8;
const scrollTop = ref(0);
const viewportHeight = ref(1);
const contentHeight = ref(1);
const isScrollbarActive = ref(false);
const isScrollbarHovering = ref(false);
const localSize = ref({ width: props.width, height: props.height });

const maxScrollTop = computed(() => Math.max(0, contentHeight.value - viewportHeight.value));
const hasScrollableContent = computed(() => maxScrollTop.value > 1);
const isScrollbarVisible = computed(() => hasScrollableContent.value && (isScrollbarActive.value || isScrollbarHovering.value));
const contentStyle = computed(() => ({
  transform: `translateY(${-scrollTop.value}px)`
}));

const popoverStyle = computed(() => {
  const viewportWidth = window.innerWidth || 1024;
  const viewportHeight = window.innerHeight || 768;
  const width = clamp(localSize.value.width, MIN_WIDTH, Math.max(MIN_WIDTH, viewportWidth - POPOVER_MARGIN * 2));
  const height = clamp(localSize.value.height, MIN_HEIGHT, Math.max(MIN_HEIGHT, viewportHeight - POPOVER_MARGIN * 2));
  const rightSideLeft = props.anchorRect.right + ANCHOR_GAP;
  const leftSideLeft = props.anchorRect.left - width - ANCHOR_GAP;
  const preferredLeft = rightSideLeft + width <= viewportWidth - POPOVER_MARGIN
    ? rightSideLeft
    : leftSideLeft;
  const left = clamp(preferredLeft, POPOVER_MARGIN, viewportWidth - width - POPOVER_MARGIN);
  const anchorMiddle = props.anchorRect.top + props.anchorRect.height / 2;
  const top = clamp(anchorMiddle - height / 2, POPOVER_MARGIN, viewportHeight - height - POPOVER_MARGIN);
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
  };
});

const scrollbarThumbStyle = computed(() => {
  const trackHeight = Math.max(1, viewportHeight.value - SCROLLBAR_VERTICAL_INSET * 2);
  const thumbHeight = Math.max(24, Math.round((viewportHeight.value / contentHeight.value) * trackHeight));
  const travel = Math.max(0, trackHeight - thumbHeight);
  const top = maxScrollTop.value > 0 ? Math.round((scrollTop.value / maxScrollTop.value) * travel) : 0;
  return {
    height: `${Math.min(trackHeight, thumbHeight)}px`,
    transform: `translateY(${top}px)`
  };
});

function handleWindowPointerDown(event: PointerEvent) {
  const target = event.target instanceof Node ? event.target : null;
  if (target && popoverRef.value?.contains(target)) {
    return;
  }
  emit("close");
}

function handleWindowKeyDown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    emit("close");
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function handleContentClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target.closest("a") : null;
  if (!target) return;
  event.preventDefault();
  const href = target.getAttribute("href");
  if (href) {
    window.usp.openExternal(href);
  }
}

function updateMeasurements() {
  const clip = contentClipRef.value;
  const content = contentInnerRef.value;
  if (!clip || !content) {
    return;
  }
  viewportHeight.value = Math.max(1, clip.clientHeight);
  contentHeight.value = Math.max(1, content.scrollHeight);
  scrollTop.value = clamp(scrollTop.value, 0, maxScrollTop.value);
}

function attachMeasurementObserver() {
  measurementObserver?.disconnect();
  if (typeof ResizeObserver === "undefined") {
    void nextTick(updateMeasurements);
    return;
  }
  measurementObserver = new ResizeObserver(() => {
    updateMeasurements();
  });
  if (contentClipRef.value) {
    measurementObserver.observe(contentClipRef.value);
  }
  if (contentInnerRef.value) {
    measurementObserver.observe(contentInnerRef.value);
  }
  void nextTick(updateMeasurements);
}

function setScrollTop(value: number) {
  scrollTop.value = clamp(value, 0, maxScrollTop.value);
}

function handleContentWheel(event: WheelEvent) {
  if (!hasScrollableContent.value) {
    return;
  }
  event.preventDefault();
  setScrollTop(scrollTop.value + event.deltaY);
  showScrollbarTemporarily();
}

function showScrollbar() {
  isScrollbarHovering.value = true;
  if (scrollbarHideTimer) {
    window.clearTimeout(scrollbarHideTimer);
    scrollbarHideTimer = null;
  }
}

function hideScrollbarSoon() {
  if (isScrollbarActive.value) {
    return;
  }
  if (scrollbarHideTimer) {
    window.clearTimeout(scrollbarHideTimer);
  }
  scrollbarHideTimer = window.setTimeout(() => {
    isScrollbarHovering.value = false;
    scrollbarHideTimer = null;
  }, 700);
}

function showScrollbarTemporarily() {
  showScrollbar();
  hideScrollbarSoon();
}

function handleScrollbarTrackPointerDown(event: PointerEvent) {
  const track = event.currentTarget as HTMLElement;
  const thumb = track.querySelector(".word-lookup-scrollbar__thumb") as HTMLElement | null;
  const thumbHeight = thumb?.offsetHeight ?? 24;
  const trackRect = track.getBoundingClientRect();
  const clickRatio = clamp((event.clientY - trackRect.top - thumbHeight / 2) / Math.max(1, trackRect.height - thumbHeight), 0, 1);
  setScrollTop(clickRatio * maxScrollTop.value);
  showScrollbarTemporarily();
}

function handleScrollbarThumbPointerDown(event: PointerEvent) {
  const startClientY = event.clientY;
  const startScrollTop = scrollTop.value;
  const trackHeight = Math.max(1, viewportHeight.value - SCROLLBAR_VERTICAL_INSET * 2);
  const thumbHeight = Math.max(24, Math.round((viewportHeight.value / contentHeight.value) * trackHeight));
  const travel = Math.max(1, trackHeight - thumbHeight);
  isScrollbarActive.value = true;
  showScrollbar();

  const handleMove = (moveEvent: PointerEvent) => {
    const delta = moveEvent.clientY - startClientY;
    setScrollTop(startScrollTop + (delta / travel) * maxScrollTop.value);
  };
  const handleUp = () => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
    isScrollbarActive.value = false;
    hideScrollbarSoon();
  };

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp, { once: true });
}

function handleResizePointerDown(event: PointerEvent) {
  const startClientX = event.clientX;
  const startClientY = event.clientY;
  const startWidth = localSize.value.width;
  const startHeight = localSize.value.height;

  const handleMove = (moveEvent: PointerEvent) => {
    const viewportWidth = window.innerWidth || 1024;
    const viewportHeight = window.innerHeight || 768;
    const width = clamp(startWidth + moveEvent.clientX - startClientX, MIN_WIDTH, viewportWidth - POPOVER_MARGIN * 2);
    const height = clamp(startHeight + moveEvent.clientY - startClientY, MIN_HEIGHT, viewportHeight - POPOVER_MARGIN * 2);
    localSize.value = { width, height };
    emit("resize", { width: Math.round(width), height: Math.round(height) });
    void nextTick(updateMeasurements);
  };
  const handleUp = () => {
    window.removeEventListener("pointermove", handleMove);
    window.removeEventListener("pointerup", handleUp);
  };

  window.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp, { once: true });
}

watch(
  () => [props.width, props.height],
  () => {
    localSize.value = {
      width: props.width,
      height: props.height
    };
    void nextTick(updateMeasurements);
  }
);

watch(() => props.matches, () => {
  scrollTop.value = 0;
  void nextTick(updateMeasurements);
});

onMounted(() => {
  window.addEventListener("pointerdown", handleWindowPointerDown, true);
  window.addEventListener("keydown", handleWindowKeyDown);
  attachMeasurementObserver();
});

watch([contentClipRef, contentInnerRef], attachMeasurementObserver);

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handleWindowPointerDown, true);
  window.removeEventListener("keydown", handleWindowKeyDown);
  measurementObserver?.disconnect();
  if (scrollbarHideTimer) {
    window.clearTimeout(scrollbarHideTimer);
  }
});
</script>
