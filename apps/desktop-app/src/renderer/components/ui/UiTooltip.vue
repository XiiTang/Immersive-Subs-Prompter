<template>
  <span
    ref="triggerWrapperEl"
    class="ui-tooltip-trigger"
    @pointerenter="scheduleOpen"
    @pointerleave="closeTooltip"
    @focusin="scheduleOpen"
    @focusout="closeTooltip"
  >
    <slot />
  </span>
  <Teleport to="body">
    <div
      v-if="open"
      ref="tooltipEl"
      class="ui-tooltip"
      data-slot="tooltip-content"
      role="tooltip"
      :style="tooltipStyle"
    >
      {{ text }}
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch, type CSSProperties } from "vue";

const props = withDefaults(
  defineProps<{
    text: string;
    side?: "top" | "right" | "bottom" | "left";
    sideOffset?: number;
    delayDuration?: number;
  }>(),
  {
    side: "top",
    sideOffset: 6,
    delayDuration: 250
  }
);

const triggerWrapperEl = ref<HTMLElement | null>(null);
const tooltipEl = ref<HTMLElement | null>(null);
const tooltipStyle = ref<CSSProperties>({});
const open = ref(false);
let openTimer: number | null = null;

watch(open, (isOpen) => {
  if (isOpen) {
    void nextTick(() => {
      updateTooltipPosition();
      document.addEventListener("keydown", handleDocumentKeydown, true);
      window.addEventListener("resize", updateTooltipPosition);
      window.addEventListener("scroll", updateTooltipPosition, true);
    });
  } else {
    removeGlobalListeners();
  }
});

onBeforeUnmount(() => {
  clearOpenTimer();
  removeGlobalListeners();
});

function scheduleOpen() {
  clearOpenTimer();
  openTimer = window.setTimeout(() => {
    open.value = true;
  }, props.delayDuration);
}

function closeTooltip() {
  clearOpenTimer();
  open.value = false;
}

function updateTooltipPosition() {
  const trigger = getTriggerElement();
  if (!trigger) {
    return;
  }
  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltipEl.value?.getBoundingClientRect();
  const tooltipWidth = tooltipRect?.width || 120;
  const tooltipHeight = tooltipRect?.height || 28;
  const viewportPadding = 8;
  let left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
  let top = triggerRect.top - tooltipHeight - props.sideOffset;

  if (props.side === "bottom") {
    top = triggerRect.bottom + props.sideOffset;
  } else if (props.side === "left") {
    left = triggerRect.left - tooltipWidth - props.sideOffset;
    top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
  } else if (props.side === "right") {
    left = triggerRect.right + props.sideOffset;
    top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
  }

  tooltipStyle.value = {
    left: `${clamp(left, viewportPadding, window.innerWidth - tooltipWidth - viewportPadding)}px`,
    position: "fixed",
    top: `${clamp(top, viewportPadding, window.innerHeight - tooltipHeight - viewportPadding)}px`
  };
}

function getTriggerElement() {
  return triggerWrapperEl.value?.firstElementChild as HTMLElement | null;
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    closeTooltip();
  }
}

function removeGlobalListeners() {
  document.removeEventListener("keydown", handleDocumentKeydown, true);
  window.removeEventListener("resize", updateTooltipPosition);
  window.removeEventListener("scroll", updateTooltipPosition, true);
}

function clearOpenTimer() {
  if (openTimer !== null) {
    window.clearTimeout(openTimer);
    openTimer = null;
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}
</script>
