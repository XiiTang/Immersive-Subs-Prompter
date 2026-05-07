<template>
  <main
    class="word-lookup-window"
    data-testid="word-lookup-floating-panel"
    @pointerenter="handlePointerEnter"
    @pointerleave="handlePointerLeave"
  >
    <section class="word-lookup-popover word-lookup-popover--window">
      <div class="word-lookup-popover__content-clip">
        <div class="word-lookup-popover__content">
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
    </section>
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { renderWordLookupMarkdown } from "../../plugins/wordLookupMarkdown";
import type { WordLookupResult } from "../../plugins/wordLookupTypes";

type WordLookupWindowPayload = {
  matches: WordLookupResult["matches"];
};

const matches = ref<WordLookupResult["matches"]>([]);
let unsubscribePayload: (() => void) | null = null;
let resizeRafId: number | null = null;

function handlePayload(payload: WordLookupWindowPayload) {
  matches.value = Array.isArray(payload.matches) ? payload.matches : [];
}

function handlePointerEnter() {
  void window.usp.notifyWordLookupWindowPointerEnter();
}

function handlePointerLeave() {
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

function reportWindowSize() {
  resizeRafId = null;
  void window.usp.resizeWordLookupWindow({
    width: window.innerWidth,
    height: window.innerHeight
  });
}

function scheduleWindowSizeReport() {
  if (resizeRafId !== null) {
    return;
  }
  resizeRafId = window.requestAnimationFrame(reportWindowSize);
}

onMounted(() => {
  unsubscribePayload = window.usp.onWordLookupWindowPayload(handlePayload);
  window.addEventListener("resize", scheduleWindowSizeReport);
  scheduleWindowSizeReport();
});

onBeforeUnmount(() => {
  unsubscribePayload?.();
  window.removeEventListener("resize", scheduleWindowSizeReport);
  if (resizeRafId !== null) {
    window.cancelAnimationFrame(resizeRafId);
    resizeRafId = null;
  }
});
</script>
