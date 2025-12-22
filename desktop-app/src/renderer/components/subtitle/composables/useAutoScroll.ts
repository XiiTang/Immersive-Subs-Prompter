import { nextTick, onBeforeUnmount, onBeforeUpdate, onMounted, ref, watch } from "vue";
import type { ComputedRef } from "vue";
import type { CombinedCue } from "../../../stores/desktop";

type ScrollBehaviorType = "auto" | "smooth";

interface UseAutoScrollOptions {
  cues: ComputedRef<CombinedCue[]>;
  activeCueIndex: ComputedRef<number | null>;
  autoScrollDelayMs: ComputedRef<number>;
  scrollPositionRatio: ComputedRef<number>;
}

export function useAutoScroll({
  cues,
  activeCueIndex,
  autoScrollDelayMs,
  scrollPositionRatio
}: UseAutoScrollOptions) {
  const subtitleListEl = ref<HTMLElement | null>(null);
  const cueRefs = ref<HTMLElement[]>([]);
  const autoScrollEnabled = ref(true);
  const isPointerDown = ref(false);
  const hasSubtitleSelection = ref(false);
  const isScrollbarActive = ref(false);

  let autoScrollTimer: number | null = null;
  let scrollbarTimer: number | null = null;

  onBeforeUpdate(() => {
    cueRefs.value = [];
  });

  function clearAutoScrollTimer() {
    if (autoScrollTimer !== null) {
      window.clearTimeout(autoScrollTimer);
      autoScrollTimer = null;
    }
  }

  function triggerScrollbar() {
    isScrollbarActive.value = true;
    if (scrollbarTimer) {
      window.clearTimeout(scrollbarTimer);
    }
    scrollbarTimer = window.setTimeout(() => {
      isScrollbarActive.value = false;
      scrollbarTimer = null;
    }, 1500);
  }

  function pauseAutoScroll() {
    autoScrollEnabled.value = false;
    clearAutoScrollTimer();
  }

  function scheduleAutoScrollRestore() {
    clearAutoScrollTimer();
    if (hasSubtitleSelection.value || isPointerDown.value) {
      return;
    }
    autoScrollTimer = window.setTimeout(() => {
      autoScrollEnabled.value = true;
      autoScrollTimer = null;
      nextTick(() => scrollToActiveCue("smooth"));
    }, autoScrollDelayMs.value);
  }

  function hasSelectionInsideList(): boolean {
    const selection = window.getSelection();
    const container = subtitleListEl.value;
    if (!selection || !container || selection.isCollapsed) {
      return false;
    }
    const contains = (node: Node | null) => Boolean(node && container.contains(node));
    return contains(selection.anchorNode) || contains(selection.focusNode);
  }

  function handleSelectionChange() {
    const isSelecting = hasSelectionInsideList();
    if (isSelecting) {
      hasSubtitleSelection.value = true;
      pauseAutoScroll();
      return;
    }
    if (hasSubtitleSelection.value) {
      hasSubtitleSelection.value = false;
      if (!isPointerDown.value) {
        scheduleAutoScrollRestore();
      }
    }
  }

  function handlePointerDown(event: MouseEvent) {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) {
      return;
    }
    isPointerDown.value = true;
    pauseAutoScroll();
  }

  function handlePointerUp(event: MouseEvent) {
    if (!isPointerDown.value || event.button !== 0) {
      return;
    }
    isPointerDown.value = false;
    handleSelectionChange();
    if (!hasSubtitleSelection.value) {
      scheduleAutoScrollRestore();
    }
  }

  function pauseAutoScrollTemporarily() {
    pauseAutoScroll();
    scheduleAutoScrollRestore();
    triggerScrollbar();
  }

  function handleMouseMove(e: MouseEvent) {
    const el = subtitleListEl.value;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (e.clientX >= rect.right - 12 && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      triggerScrollbar();
    }
  }

  function scrollToActiveCue(behavior: ScrollBehaviorType = "smooth") {
    if (!autoScrollEnabled.value) {
      return;
    }
    const index = activeCueIndex.value;
    const container = subtitleListEl.value;
    if (index === null || !container) {
      return;
    }
    const target = cueRefs.value[index];
    if (!target) {
      return;
    }
    const targetTop =
      target.offsetTop - container.clientHeight * scrollPositionRatio.value + target.offsetHeight / 2;
    container.scrollTo({
      top: targetTop,
      behavior
    });
  }

  function setCueRef(el: Element | null, index: number) {
    if (el) {
      cueRefs.value[index] = el as HTMLElement;
    }
  }

  watch(activeCueIndex, (next, prev) => {
    if (next === null || !autoScrollEnabled.value) {
      return;
    }
    const behavior: ScrollBehaviorType = prev === null ? "auto" : "smooth";
    nextTick(() => scrollToActiveCue(behavior));
  });

  watch(
    cues,
    () => {
      if (autoScrollEnabled.value && activeCueIndex.value !== null) {
        nextTick(() => scrollToActiveCue("auto"));
      }
    },
    { deep: false }
  );

  watch(
    scrollPositionRatio,
    () => {
      if (autoScrollEnabled.value && activeCueIndex.value !== null) {
        nextTick(() => scrollToActiveCue("auto"));
      }
    },
    { deep: false }
  );

  watch(autoScrollDelayMs, () => {
    if (!autoScrollEnabled.value && autoScrollTimer !== null) {
      scheduleAutoScrollRestore();
    }
  });

  onMounted(() => {
    const list = subtitleListEl.value;
    list?.addEventListener("wheel", pauseAutoScrollTemporarily, { passive: true });
    list?.addEventListener("touchmove", pauseAutoScrollTemporarily, { passive: true });
    list?.addEventListener("mousemove", handleMouseMove, { passive: true });
    list?.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("mouseup", handlePointerUp);
    document.addEventListener("selectionchange", handleSelectionChange);
  });

  onBeforeUnmount(() => {
    const list = subtitleListEl.value;
    list?.removeEventListener("wheel", pauseAutoScrollTemporarily);
    list?.removeEventListener("touchmove", pauseAutoScrollTemporarily);
    list?.removeEventListener("mousemove", handleMouseMove);
    list?.removeEventListener("mousedown", handlePointerDown);
    window.removeEventListener("mouseup", handlePointerUp);
    document.removeEventListener("selectionchange", handleSelectionChange);
    clearAutoScrollTimer();
    if (scrollbarTimer) {
      window.clearTimeout(scrollbarTimer);
      scrollbarTimer = null;
    }
  });

  return {
    subtitleListEl,
    cueRefs,
    autoScrollEnabled,
    isScrollbarActive,
    setCueRef,
    pauseAutoScrollTemporarily,
    handleSelectionChange,
    handlePointerDown,
    handlePointerUp,
    scrollToActiveCue
  };
}
