import { onBeforeUnmount, onMounted, onWatcherCleanup, ref, watch } from "vue";
import type { Ref } from "vue";

type UseTranscriptSelectionInput = {
  rootEl: Ref<HTMLElement | null>;
  autoScrollDelayMs: Ref<number>;
  onResume: () => void;
};

export function useTranscriptSelection({ rootEl, autoScrollDelayMs, onResume }: UseTranscriptSelectionInput) {
  const isSelectionPaused = ref(false);
  const isAutoFollowPaused = ref(false);
  const isPointerDown = ref(false);
  let resumeTimer: number | null = null;

  function clearResumeTimer() {
    if (resumeTimer !== null) {
      window.clearTimeout(resumeTimer);
      resumeTimer = null;
    }
  }

  function pauseAutoFollow() {
    isAutoFollowPaused.value = true;
    clearResumeTimer();
  }

  function hasSelectionInsideRoot(): boolean {
    const root = rootEl.value;
    const selection = window.getSelection();
    if (!root || !selection || selection.isCollapsed) {
      return false;
    }
    return root.contains(selection.anchorNode) || root.contains(selection.focusNode);
  }

  function scheduleResume() {
    clearResumeTimer();
    resumeTimer = window.setTimeout(() => {
      if (isSelectionPaused.value || isPointerDown.value) {
        return;
      }
      isAutoFollowPaused.value = false;
      resumeTimer = null;
      onResume();
    }, autoScrollDelayMs.value);
  }

  function handleSelectionChange() {
    const hasSelection = hasSelectionInsideRoot();

    if (hasSelection) {
      isSelectionPaused.value = true;
      pauseAutoFollow();
      return;
    }

    if (isSelectionPaused.value) {
      isSelectionPaused.value = false;
      scheduleResume();
    }
  }

  function handleWheelOrTouchMove() {
    pauseAutoFollow();
    if (!isSelectionPaused.value) {
      scheduleResume();
    }
  }

  function handleMouseDown(event: MouseEvent) {
    const root = rootEl.value;
    const target = event.target instanceof Node ? event.target : null;
    if (
      event.button !== 0 ||
      !root ||
      !target ||
      !root.contains(target) ||
      (target instanceof Element && target.closest("button"))
    ) {
      return;
    }
    isPointerDown.value = true;
  }

  function handleMouseUp(event: MouseEvent) {
    if (event.button !== 0 || !isPointerDown.value) {
      return;
    }
    isPointerDown.value = false;
    handleSelectionChange();
    if (!isSelectionPaused.value) {
      scheduleResume();
    }
  }

  function clearAutoFollowPause() {
    clearResumeTimer();
    isSelectionPaused.value = false;
    isAutoFollowPaused.value = false;
    isPointerDown.value = false;
  }

  watch(autoScrollDelayMs, () => {
    if (isAutoFollowPaused.value && resumeTimer !== null) {
      scheduleResume();
      onWatcherCleanup(() => {
        clearResumeTimer();
      });
    }
  });

  onMounted(() => {
    const root = rootEl.value;
    root?.addEventListener("wheel", handleWheelOrTouchMove, { passive: true });
    root?.addEventListener("touchmove", handleWheelOrTouchMove, { passive: true });
    root?.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("selectionchange", handleSelectionChange);
  });

  onBeforeUnmount(() => {
    const root = rootEl.value;
    root?.removeEventListener("wheel", handleWheelOrTouchMove);
    root?.removeEventListener("touchmove", handleWheelOrTouchMove);
    root?.removeEventListener("mousedown", handleMouseDown);
    window.removeEventListener("mouseup", handleMouseUp);
    document.removeEventListener("selectionchange", handleSelectionChange);
    clearResumeTimer();
  });

  return {
    isSelectionPaused,
    isAutoFollowPaused,
    clearAutoFollowPause
  };
}
