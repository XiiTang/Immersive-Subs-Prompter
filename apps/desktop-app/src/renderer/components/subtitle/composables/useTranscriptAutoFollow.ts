import { nextTick, watch } from "vue";
import type { Ref } from "vue";

type UseTranscriptAutoFollowInput = {
  containerEl: Ref<HTMLElement | null>;
  enabled: Ref<boolean>;
  targetScrollTop: Ref<number | null>;
  suppressScheduledScroll?: Ref<boolean>;
  followScrollBehavior?: Ref<ScrollBehavior>;
};

export function useTranscriptAutoFollow({
  containerEl,
  enabled,
  targetScrollTop,
  suppressScheduledScroll,
  followScrollBehavior
}: UseTranscriptAutoFollowInput) {
  function scrollToProjectedPosition(behavior: ScrollBehavior = "smooth") {
    if (!enabled.value) {
      return;
    }
    const container = containerEl.value;
    if (!container || targetScrollTop.value === null) {
      return;
    }
    container.scrollTo({
      top: targetScrollTop.value,
      behavior
    });
  }

  watch([targetScrollTop, enabled], ([nextTargetScrollTop, isEnabled], previousValues) => {
    const previousTargetScrollTop = previousValues?.[0];
    if (!isEnabled || nextTargetScrollTop === null || nextTargetScrollTop === previousTargetScrollTop) {
      return;
    }
    nextTick(() => {
      if (suppressScheduledScroll?.value) {
        suppressScheduledScroll.value = false;
        return;
      }
      scrollToProjectedPosition(
        previousTargetScrollTop === undefined ? "auto" : followScrollBehavior?.value ?? "smooth"
      );
    });
  }, { immediate: true });

  return {
    scrollToProjectedPosition
  };
}
