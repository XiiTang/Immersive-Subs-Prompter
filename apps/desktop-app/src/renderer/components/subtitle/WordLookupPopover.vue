<template>
  <aside
    ref="popoverRef"
    class="word-lookup-popover"
    :style="popoverStyle"
    role="dialog"
    aria-live="polite"
    @pointerdown.stop
  >
    <div class="word-lookup-popover__content">
      <article v-for="match in matches" :key="`${match.fileOrder}-${match.word}`" class="word-lookup-entry">
        <header class="word-lookup-entry__header">
          <span class="word-lookup-entry__word">{{ match.word }}</span>
          <span v-if="match.aliases.length" class="word-lookup-entry__aliases">{{ match.aliases.join(", ") }}</span>
        </header>
        <div class="word-lookup-entry__body" v-html="renderWordLookupMarkdown(match.content)" @click="handleContentClick" />
      </article>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { renderWordLookupMarkdown } from "../../plugins/wordLookupMarkdown";
import type { WordLookupResult } from "../../plugins/wordLookupTypes";

const props = defineProps<{
  x: number;
  y: number;
  width: number;
  height: number;
  matches: WordLookupResult["matches"];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "resize", size: { width: number; height: number }): void;
}>();

const popoverRef = ref<HTMLElement | null>(null);
let resizeObserver: ResizeObserver | null = null;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 180;

const popoverStyle = computed(() => {
  const margin = 12;
  const viewportWidth = window.innerWidth || 1024;
  const viewportHeight = window.innerHeight || 768;
  const width = Math.min(Math.max(props.width, MIN_WIDTH), Math.max(MIN_WIDTH, viewportWidth - margin * 2));
  const height = Math.min(Math.max(props.height, MIN_HEIGHT), Math.max(MIN_HEIGHT, viewportHeight - margin * 2));
  const left = Math.max(margin, Math.min(props.x + 12, viewportWidth - width - margin));
  const top = Math.max(margin, Math.min(props.y + 12, viewportHeight - height - margin));
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`
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

function handleContentClick(event: MouseEvent) {
  const target = event.target instanceof Element ? event.target.closest("a") : null;
  if (!target) return;
  event.preventDefault();
  const href = target.getAttribute("href");
  if (href) {
    window.usp.openExternal(href);
  }
}

function attachResizeObserver() {
  resizeObserver?.disconnect();
  if (!popoverRef.value || typeof ResizeObserver === "undefined") {
    return;
  }
  resizeObserver = new ResizeObserver(([entry]) => {
    if (!entry || !popoverRef.value) return;
    emit("resize", getBorderBoxSize(popoverRef.value, entry));
  });
  resizeObserver.observe(popoverRef.value);
}

function getBorderBoxSize(element: HTMLElement, entry: ResizeObserverEntry) {
  const borderBoxSize = Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize;
  if (borderBoxSize) {
    return {
      width: Math.round(borderBoxSize.inlineSize),
      height: Math.round(borderBoxSize.blockSize)
    };
  }
  const rect = element.getBoundingClientRect();
  return {
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  };
}

onMounted(() => {
  window.addEventListener("pointerdown", handleWindowPointerDown, true);
  window.addEventListener("keydown", handleWindowKeyDown);
  attachResizeObserver();
});

watch(popoverRef, attachResizeObserver);

onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", handleWindowPointerDown, true);
  window.removeEventListener("keydown", handleWindowKeyDown);
  resizeObserver?.disconnect();
});
</script>
