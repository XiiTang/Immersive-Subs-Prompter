<template>
  <div class="window" :class="windowClasses">
    <HeaderBar />
    <div class="window__content">
      <div class="primary-view">
        <SubtitleList />
      </div>
      <SettingsPanel v-show="store.isSettingsOpen" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import HeaderBar from "./components/HeaderBar.vue";
import SubtitleList from "./components/SubtitleList.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import { useDesktopStore, DEFAULT_PROFILE_TEMPLATE } from "./stores/desktop";
import type { ProfileSettings } from "./main/types.js";
import { normalizeLanguage } from "./i18n.js";

const store = useDesktopStore();

const DEFAULT_SUBTITLE_FONT_FAMILY =
  '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

const autoHideCollapsed = ref(false);
const lastPointerPosition = ref<{ x: number; y: number } | null>(null);
const isPointerInWindow = ref(false);
const headerElement = ref<HTMLElement | null>(null);
const videoInfoSectionElement = ref<HTMLElement | null>(null);

const autoHideEnabled = computed(() => store.settings?.global.autoHidePanels ?? false);
const windowClasses = computed(() => ({
  "window--settings-open": store.isSettingsOpen,
  "auto-hide-collapsed": autoHideCollapsed.value
}));

function applySubtitleStyles(settings: ProfileSettings | null) {
  const root = document.documentElement;
  const config = settings ?? DEFAULT_PROFILE_TEMPLATE;
  root.style.setProperty(
    "--subtitle-font-family",
    config.subtitleFontFamily?.trim() || DEFAULT_SUBTITLE_FONT_FAMILY
  );
  root.style.setProperty("--subtitle-font-size", `${config.subtitleFontSize ?? 14}px`);
  root.style.setProperty("--subtitle-line-spacing", `${config.subtitleLineSpacing ?? 0}px`);
  root.style.setProperty("--subtitle-time-text-gap", `${config.subtitleTimeTextGap ?? 2}px`);
  root.style.setProperty(
    "--subtitle-primary-secondary-gap",
    `${config.subtitlePrimarySecondaryGap ?? 3}px`
  );
  root.style.setProperty("--subtitle-line-height", `${config.subtitleLineHeight ?? 1.45}`);
  root.style.setProperty(
    "--subtitle-primary-text-color",
    config.subtitlePrimaryColor ?? DEFAULT_PROFILE_TEMPLATE.subtitlePrimaryColor
  );
  root.style.setProperty(
    "--subtitle-secondary-text-color",
    config.subtitleSecondaryColor ?? DEFAULT_PROFILE_TEMPLATE.subtitleSecondaryColor
  );
  root.style.setProperty(
    "--subtitle-active-primary-text-color",
    config.subtitleActivePrimaryColor ?? DEFAULT_PROFILE_TEMPLATE.subtitleActivePrimaryColor
  );
  root.style.setProperty(
    "--subtitle-active-secondary-text-color",
    config.subtitleActiveSecondaryColor ?? DEFAULT_PROFILE_TEMPLATE.subtitleActiveSecondaryColor
  );
}

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
  if (!autoHideEnabled.value || store.isSettingsOpen) {
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

watch(
  () => store.editingProfileSettings,
  (settings) => applySubtitleStyles(settings),
  { deep: true, immediate: true }
);



watch(autoHideEnabled, (enabled) => {
  if (!enabled) {
    autoHideCollapsed.value = false;
    return;
  }
  updateAutoHideState();
});

watch(
  () => store.isSettingsOpen,
  (open) => {
    if (open) {
      autoHideCollapsed.value = false;
    } else {
      updateAutoHideState();
    }
  }
);

watch(
  () => store.settings?.global.language,
  (lang) => {
    document.documentElement.lang = normalizeLanguage(lang);
  },
  { immediate: true }
);
</script>
