<template>
  <div class="window" :class="windowClasses">
    <HeaderBar />
    <div class="window__content">
      <div class="primary-view">
        <SubtitleList />
      </div>
      <SettingsPanel v-show="store.isSettingsOpen" @preview-auto-hide="setAutoHidePreview" />
    </div>
    <div class="auto-hide-preview" :class="{ 'is-visible': autoHidePreviewVisible }"></div>
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
import { DEFAULT_AUTO_HIDE_MOUSE_LEAVE_DELAY_MS } from "../common/autoHide.js";

const store = useDesktopStore();

const DEFAULT_SUBTITLE_FONT_FAMILY =
  '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

const autoHideCollapsed = ref(false);
const autoHidePreviewVisible = ref(false);
const lastPointerY = ref<number | null>(null);
const isPointerInWindow = ref(false);
const autoHideCollapseTimer = ref<number | null>(null);

const autoHideEnabled = computed(() => store.settings?.global.autoHidePanels ?? false);
const autoHideDelayMs = computed(
  () => store.autoHideMouseLeaveDelay ?? DEFAULT_AUTO_HIDE_MOUSE_LEAVE_DELAY_MS
);
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

function applyPanelOpacity(value: number | null | undefined) {
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, Number(value))) : 100;
  document.documentElement.style.setProperty("--panel-opacity-factor", (clamped / 100).toFixed(2));
}

function updateAutoHideState(pointerY?: number | null) {
  if (!autoHideEnabled.value || store.isSettingsOpen) {
    clearAutoHideCollapseTimer();
    autoHideCollapsed.value = false;
    return;
  }
  if (typeof pointerY === "number") {
    lastPointerY.value = pointerY;
    isPointerInWindow.value = true;
  }
  const lastPointerValue = lastPointerY.value;
  const pointerKnown = isPointerInWindow.value && typeof lastPointerValue === "number";
  const shouldCollapse = !pointerKnown || lastPointerValue > store.autoHideZoneHeight;
  if (shouldCollapse) {
    scheduleAutoHideCollapse();
  } else {
    clearAutoHideCollapseTimer();
    autoHideCollapsed.value = false;
  }
}

function handlePointerMove(event: PointerEvent) {
  isPointerInWindow.value = true;
  updateAutoHideState(event.clientY);
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
  lastPointerY.value = null;
  updateAutoHideState(null);
}

function clearAutoHideCollapseTimer() {
  if (autoHideCollapseTimer.value !== null) {
    window.clearTimeout(autoHideCollapseTimer.value);
    autoHideCollapseTimer.value = null;
  }
}

function scheduleAutoHideCollapse() {
  if (autoHideCollapseTimer.value !== null) {
    return;
  }
  const delay = Math.max(0, autoHideDelayMs.value);
  if (delay === 0) {
    autoHideCollapsed.value = true;
    return;
  }
  autoHideCollapseTimer.value = window.setTimeout(() => {
    autoHideCollapsed.value = true;
    autoHideCollapseTimer.value = null;
  }, delay);
}

function setAutoHidePreview(visible: boolean) {
  autoHidePreviewVisible.value = visible;
}

onMounted(() => {
  store.initialize();
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
  clearAutoHideCollapseTimer();
});

watch(
  () => store.editingProfileSettings,
  (settings) => applySubtitleStyles(settings),
  { deep: true, immediate: true }
);

watch(
  () => store.panelOpacity,
  (value) => applyPanelOpacity(value),
  { immediate: true }
);

watch(
  () => store.autoHideZoneHeight,
  (height) => {
    document.documentElement.style.setProperty("--auto-hide-zone-height", `${height}px`);
    updateAutoHideState();
  },
  { immediate: true }
);

watch(autoHideEnabled, (enabled) => {
  if (!enabled) {
    clearAutoHideCollapseTimer();
    autoHideCollapsed.value = false;
    return;
  }
  updateAutoHideState();
});

watch(
  () => store.isSettingsOpen,
  (open) => {
    if (open) {
      clearAutoHideCollapseTimer();
      autoHideCollapsed.value = false;
    } else {
      updateAutoHideState();
    }
  }
);

watch(autoHideDelayMs, () => {
  if (!autoHideEnabled.value || store.isSettingsOpen) {
    clearAutoHideCollapseTimer();
    return;
  }
  clearAutoHideCollapseTimer();
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
