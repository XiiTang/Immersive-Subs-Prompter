import { nextTick, watch } from "vue";
import type { Ref } from "vue";

type UseTranscriptAutoFollowInput = {
  containerEl: Ref<HTMLElement | null>;
  enabled: Ref<boolean>;
  targetScrollTop: Ref<number | null>;
};

export function useTranscriptAutoFollow({
  containerEl,
  enabled,
  targetScrollTop
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
      scrollToProjectedPosition(previousTargetScrollTop === undefined ? "auto" : "smooth");
    });
  }, { immediate: true });

  return {
    scrollToProjectedPosition
  };
}
