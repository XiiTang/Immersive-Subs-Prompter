<template>
  <div class="window" :class="windowClasses">
    <HeaderBar />
    <div class="window__content">
      <div class="primary-view">
        <SubtitleView />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import HeaderBar from "./components/HeaderBar.vue";
import SubtitleView from "./components/subtitle/SubtitleView.vue";
import { useDesktopStore } from "./stores/desktop";
import { normalizeLanguage } from "./i18n.js";

const store = useDesktopStore();

const autoHideCollapsed = ref(false);
const lastPointerPosition = ref<{ x: number; y: number } | null>(null);
const isPointerInWindow = ref(false);
const headerElement = ref<HTMLElement | null>(null);
const videoInfoSectionElement = ref<HTMLElement | null>(null);

const autoHideEnabled = computed(() => store.settings?.global.autoHidePanels ?? false);
const windowClasses = computed(() => ({
  "auto-hide-collapsed": autoHideCollapsed.value
}));

function refreshAutoHideElements() {
  if (!headerElement.value) {
    headerElement.value = document.querySelector(".window__header");
  }
  if (!videoInfoSectionElement.value) {
    videoInfoSectionElement.value = document.querySelector(".video-info-section");
  }
}

function isPointerInsideElement(point: { x: number; y: number } | null, element: HTMLElement | null): boolean {
  if (!point || !element) {
    return false;
  }
  const rect = element.getBoundingClientRect();
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

function shouldShowPanels(pointer: { x: number; y: number } | null): boolean {
  if (!autoHideEnabled.value) {
    return true;
  }
  refreshAutoHideElements();
  if (!isPointerInWindow.value || !pointer) {
    return false;
  }
  // Fixed trigger zone height to header height (45px)
  const inTriggerZone = pointer.y <= 45;
  const inPanelArea =
    isPointerInsideElement(pointer, headerElement.value) ||
    isPointerInsideElement(pointer, videoInfoSectionElement.value);
  return inTriggerZone || inPanelArea;
}

function updateAutoHideState(pointer?: { x: number; y: number }) {
  if (pointer) {
    lastPointerPosition.value = pointer;
    isPointerInWindow.value = true;
  }
  const activePointer = isPointerInWindow.value ? lastPointerPosition.value : null;
  autoHideCollapsed.value = !shouldShowPanels(activePointer);
}

function handlePointerMove(event: PointerEvent) {
  isPointerInWindow.value = true;
  updateAutoHideState({ x: event.clientX, y: event.clientY });
}

function handlePointerLeave() {
  markPointerLeftWindow();
}

function handlePointerOut(event: PointerEvent) {
  if (event.relatedTarget === null) {
    markPointerLeftWindow();
  }
}

function handleWindowBlur() {
  markPointerLeftWindow();
}

function markPointerLeftWindow() {
  isPointerInWindow.value = false;
  lastPointerPosition.value = null;
  updateAutoHideState();
}

onMounted(() => {
  store.initialize();
  headerElement.value = document.querySelector(".window__header");
  videoInfoSectionElement.value = document.querySelector(".video-info-section");
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
  window.addEventListener("pointerout", handlePointerOut, { passive: true });
  window.addEventListener("blur", handleWindowBlur);
});

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", handlePointerMove);
  window.removeEventListener("pointerleave", handlePointerLeave);
  window.removeEventListener("pointerout", handlePointerOut);
  window.removeEventListener("blur", handleWindowBlur);
});

watch(autoHideEnabled, (enabled) => {
  if (!enabled) {
    autoHideCollapsed.value = false;
    return;
  }
  updateAutoHideState();
});

watch(
  () => store.settings?.global.language,
  (lang) => {
    document.documentElement.lang = normalizeLanguage(lang);
  },
  { immediate: true }
);
</script>
