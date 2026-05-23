<template>
  <section
    class="top-control-panel"
    :class="panelClasses"
    :style="panelGeometryStyle"
    data-testid="top-control-panel"
  >
    <div
      v-if="autoHideEnabled && panelMode === 'collapsed'"
      class="top-edge-trigger-zone"
      data-testid="top-edge-trigger-zone"
      @pointerenter="enterExpanded"
    />
    <section
      ref="surfaceRef"
      class="top-control-panel__surface"
      data-testid="top-control-panel-surface"
    >
      <header
        ref="headerRef"
        class="top-control-panel__header"
        data-testid="top-control-panel-header"
      >
        <div class="top-control-panel__header-main">
          <div
            class="top-control-panel__drag-handle"
            data-testid="top-control-panel-drag-handle"
          >
            <div
              class="top-control-panel__header-labels"
              data-testid="top-control-panel-header-labels"
            >
              <div class="top-control-panel__status" data-testid="top-control-panel-status">
                {{ connectionText }}
              </div>
            </div>
          </div>
        </div>
        <div class="top-control-panel__actions" data-testid="top-control-panel-actions">
          <UiTooltip text="Background opacity">
            <div class="transparency-inline">
              <UiSlider
                v-model="panelOpacityValue"
                class="header-slider"
                :min="0"
                :max="100"
                :step="1"
                label="Background opacity"
              />
            </div>
          </UiTooltip>
          <UiTooltip :text="pinLabel">
            <UiIconButton
              :label="pinLabel"
              :pressed="isPinned"
              :active="isPinned"
              @click="cyclePin"
            >
              <IconPin v-if="alwaysOnTop === 'off'" size="md" />
              <IconPin v-else-if="alwaysOnTop === 'floating'" size="md" />
              <IconLock v-else size="md" />
            </UiIconButton>
          </UiTooltip>
          <UiTooltip :text="fullscreenLabel">
            <UiIconButton
              :label="fullscreenLabel"
              :pressed="store.desktopState?.isFullscreen"
              @click="store.toggleFullscreen()"
            >
              <IconFullscreen size="md" />
            </UiIconButton>
          </UiTooltip>
          <UiTooltip text="Open settings">
            <UiIconButton label="Open settings" @click="openSettingsWindow">
              <IconSettings size="md" />
            </UiIconButton>
          </UiTooltip>
        </div>
      </header>
      <div class="top-control-panel__body" data-testid="top-control-panel-body">
        <section class="top-control-panel__info">
          <p class="top-control-panel__info-title">{{ title }}</p>
          <p class="top-control-panel__info-profile">{{ profileLabel }}</p>
          <p class="top-control-panel__info-url">{{ displayUrl }}</p>
        </section>
        <section v-if="hasActiveVideo" class="control-panel">
          <TrackSelector
            v-model="localPrimaryTrackId"
            :tracks="subtitleTracks"
            :lead-label="t('primary-track-label', 'Primary Subtitle')"
            :aria-label="t('primary-track-label', 'Primary Subtitle')"
            :grow="!transcriptionEnabled"
            :format-source-file="formatSourceFile"
          />
          <TrackSelector
            v-model="localSecondaryTrackId"
            :tracks="subtitleTracks"
            :aria-label="t('secondary-track-none', 'None')"
            :none-label="t('secondary-track-none', 'None')"
            :grow="!transcriptionEnabled"
            :format-source-file="formatSourceFile"
          />
          <TranscriptionControls
            v-if="transcriptionEnabled"
            :configs="transcriptionConfigs"
            v-model:active-id="localActiveTranscriptionId"
            :can-transcribe="canTranscribe"
            :is-transcribing="isTranscribing"
            :t="t"
            @start="$emit('start-transcription')"
          />
        </section>
        <div class="status-row">
          <StatusBanner :banner="statusBanner" />
        </div>
        <PlaybackControls
          :is-playing="isPlaying"
          :has-active-video="hasActiveVideo"
          :displayed-playback-time="displayedPlaybackTime"
          :playback-duration="playbackDuration || 0"
          :slider-max="sliderMax"
          :slider-step="sliderStep"
          :slider-value="sliderValue"
          :slider-enabled="sliderEnabled"
          :slider-fill-style="sliderFillStyle"
          :auto-hide-enabled="autoHideEnabled"
          :t="t"
          @toggle-playback="$emit('toggle-playback')"
          @scrub-start="$emit('scrub-start')"
          @scrub-input="$emit('scrub-input', $event)"
          @scrub-end="$emit('scrub-end', $event)"
          @scrub-cancel="$emit('scrub-cancel')"
          @toggle-auto-hide="$emit('toggle-auto-hide')"
        />
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, useTemplateRef, nextTick } from "vue";
import PlaybackControls from "../subtitle/PlaybackControls.vue";
import StatusBanner from "../subtitle/StatusBanner.vue";
import TrackSelector from "../subtitle/TrackSelector.vue";
import TranscriptionControls from "../subtitle/TranscriptionControls.vue";
import { useDesktopStore } from "../../stores/desktop";
import { UiIconButton, UiSlider, UiTooltip } from "../ui";
import { IconFullscreen, IconLock, IconPin, IconSettings } from "../icons";

interface SubtitleTrackOption {
  id: string;
  sourceFile: string;
}

interface StatusBannerState {
  text: string;
  tone: "neutral" | "success" | "warning" | "danger" | "info";
}

const AUTO_HIDE_COLLAPSE_DELAY_MS = 200;
const POINTER_STATE_POLL_INTERVAL_MS = 50;

const {
  title,
  profileLabel,
  displayUrl,
  subtitleTracks,
  primaryTrackId,
  secondaryTrackId,
  transcriptionEnabled,
  transcriptionConfigs,
  activeTranscriptionId,
  canTranscribe,
  isTranscribing,
  statusBanner,
  hasActiveVideo,
  isPlaying,
  displayedPlaybackTime,
  playbackDuration,
  sliderMax,
  sliderStep,
  sliderValue,
  sliderEnabled,
  sliderFillStyle,
  autoHideEnabled,
  formatSourceFile,
  t
} = defineProps<{
  title: string;
  profileLabel: string;
  displayUrl: string;
  subtitleTracks: SubtitleTrackOption[];
  primaryTrackId: string;
  secondaryTrackId: string;
  transcriptionEnabled: boolean;
  transcriptionConfigs: any[];
  activeTranscriptionId: string;
  canTranscribe: boolean;
  isTranscribing: boolean;
  statusBanner: StatusBannerState;
  hasActiveVideo: boolean;
  isPlaying: boolean;
  displayedPlaybackTime: number;
  playbackDuration: number | null;
  sliderMax: number;
  sliderStep: number;
  sliderValue: number;
  sliderEnabled: boolean;
  sliderFillStyle: Record<string, string>;
  autoHideEnabled: boolean;
  formatSourceFile: (sourceFile: string) => string;
  t: (key: string, fallback?: string, params?: Record<string, any>) => string;
}>();

const emit = defineEmits<{
  (e: "update:primaryTrackId", value: string): void;
  (e: "update:secondaryTrackId", value: string): void;
  (e: "update:activeTranscriptionId", value: string): void;
  (e: "toggle-playback"): void;
  (e: "start-transcription"): void;
  (e: "scrub-start"): void;
  (e: "scrub-input", event: Event): void;
  (e: "scrub-end", event?: Event): void;
  (e: "scrub-cancel"): void;
  (e: "toggle-auto-hide"): void;
}>();

const store = useDesktopStore();
const panelMode = ref<"force-expanded" | "collapsed" | "expanded" | "collapse-pending">("collapsed");
let collapseTimerId: number | null = null;
let resizeObserver: ResizeObserver | null = null;
let pointerStatePollTimerId: number | null = null;
let pointerStateSyncInFlight = false;
let panelStateVersion = 0;

const surfaceRef = useTemplateRef<HTMLElement>("surfaceRef");
const headerRef = useTemplateRef<HTMLElement>("headerRef");
const headerHeight = ref(0);
const surfaceHeight = ref(0);

function syncPanelGeometry() {
  headerHeight.value = headerRef.value?.offsetHeight ?? 0;
  surfaceHeight.value = surfaceRef.value?.offsetHeight ?? 0;
}

const collapsedOffset = computed(() => Math.max(surfaceHeight.value, 0));
const panelGeometryStyle = computed(() => ({
  "--top-panel-header-height": `${headerHeight.value}px`,
  "--top-panel-collapsed-offset": `${collapsedOffset.value}px`
}));

const connectionText = computed(() => store.connectionLabel);
const alwaysOnTop = computed(() => store.settings?.global.alwaysOnTop ?? "off");
const pinLabels: Record<string, string> = {
  off: "Not pinned",
  floating: "Pinned",
  "screen-saver": "Pinned (screen saver)"
};
const pinLabel = computed(() => pinLabels[alwaysOnTop.value] ?? "Pinned");
const isPinned = computed(() => alwaysOnTop.value !== "off");
const fullscreenLabel = computed(() =>
  store.desktopState?.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
);
const panelOpacityValue = computed({
  get: () => store.panelOpacity,
  set: (value: number) => store.updateGlobalSetting("panelOpacity", value)
});
const panelClasses = computed(() => ({
  "top-control-panel--force-expanded": panelMode.value === "force-expanded",
  "top-control-panel--collapsed": panelMode.value === "collapsed",
  "top-control-panel--expanded": panelMode.value === "expanded",
  "top-control-panel--collapse-pending": panelMode.value === "collapse-pending",
  "top-control-panel--draggable":
    panelMode.value === "expanded" || panelMode.value === "force-expanded"
}));

const localPrimaryTrackId = computed({
  get: () => primaryTrackId,
  set: (value: string) => emit("update:primaryTrackId", value)
});

const localSecondaryTrackId = computed({
  get: () => secondaryTrackId,
  set: (value: string) => emit("update:secondaryTrackId", value)
});

const localActiveTranscriptionId = computed({
  get: () => activeTranscriptionId,
  set: (value: string) => emit("update:activeTranscriptionId", value)
});

function clearCollapseTimer() {
  if (collapseTimerId !== null) {
    window.clearTimeout(collapseTimerId);
    collapseTimerId = null;
  }
}

function setPanelMode(nextMode: "force-expanded" | "collapsed" | "expanded" | "collapse-pending") {
  if (panelMode.value === nextMode) {
    return;
  }
  panelMode.value = nextMode;
  panelStateVersion += 1;
}

function collapseImmediately() {
  clearCollapseTimer();
  setPanelMode(autoHideEnabled ? "collapsed" : "force-expanded");
}

function enterExpanded() {
  clearCollapseTimer();
  syncPanelGeometry();
  setPanelMode(autoHideEnabled ? "expanded" : "force-expanded");
}

function scheduleCollapse() {
  if (!autoHideEnabled) {
    setPanelMode("force-expanded");
    return;
  }
  if (panelMode.value === "collapse-pending") {
    return;
  }

  clearCollapseTimer();
  setPanelMode("collapse-pending");
  collapseTimerId = window.setTimeout(() => {
    collapseTimerId = null;
    setPanelMode("collapsed");
  }, AUTO_HIDE_COLLAPSE_DELAY_MS);
}

function isWithinVerticalBounds(y: number | null, maxHeight: number) {
  return typeof y === "number" && y >= 0 && y <= maxHeight;
}

function isInsideExpandTrigger(pointerState: { insideWindow: boolean; x: number | null; y: number | null }) {
  return pointerState.insideWindow && isWithinVerticalBounds(pointerState.y, headerHeight.value);
}

function isInsideExpandedSurface(pointerState: { insideWindow: boolean; x: number | null; y: number | null }) {
  return pointerState.insideWindow && isWithinVerticalBounds(pointerState.y, surfaceHeight.value);
}

async function syncPointerState() {
  if (!autoHideEnabled || pointerStateSyncInFlight) {
    return;
  }

  pointerStateSyncInFlight = true;
  const syncVersion = panelStateVersion;
  try {
    const pointerState = await window.usp.getWindowPointerState();
    if (syncVersion !== panelStateVersion) {
      return;
    }

    if (panelMode.value === "collapsed") {
      if (headerHeight.value <= 0) {
        syncPanelGeometry();
      }
      if (isInsideExpandTrigger(pointerState)) {
        enterExpanded();
      }
      return;
    }

    if (surfaceHeight.value <= 0) {
      syncPanelGeometry();
      return;
    }

    if (isInsideExpandedSurface(pointerState)) {
      enterExpanded();
      return;
    }

    if (panelMode.value === "expanded") {
      scheduleCollapse();
    }
  } finally {
    pointerStateSyncInFlight = false;
  }
}

function stopPointerStatePolling() {
  if (pointerStatePollTimerId !== null) {
    globalThis.clearInterval(pointerStatePollTimerId);
    pointerStatePollTimerId = null;
  }
}

function startPointerStatePolling() {
  stopPointerStatePolling();
  if (!autoHideEnabled) {
    return;
  }
  pointerStatePollTimerId = window.setInterval(() => {
    void syncPointerState();
  }, POINTER_STATE_POLL_INTERVAL_MS);
  void syncPointerState();
}

async function openSettingsWindow() {
  await window.usp.openSettingsWindow();
}

function cyclePin() {
  const order = ["off", "floating", "screen-saver"] as const;
  const current = alwaysOnTop.value;
  const index = order.indexOf(current as (typeof order)[number]);
  const next = order[(index + 1) % order.length];
  store.updateGlobalSetting("alwaysOnTop", next);
}

watch(
  () => autoHideEnabled,
  (enabled, previous) => {
    clearCollapseTimer();
    if (!enabled) {
      stopPointerStatePolling();
      setPanelMode("force-expanded");
      return;
    }
    setPanelMode(previous === false ? "expanded" : "collapsed");
    startPointerStatePolling();
  },
  { immediate: true }
);

onMounted(() => {
  window.addEventListener("blur", collapseImmediately);
  window.addEventListener("resize", syncPanelGeometry);
  nextTick(() => {
    syncPanelGeometry();
    resizeObserver = new ResizeObserver(() => syncPanelGeometry());
    if (headerRef.value) {
      resizeObserver.observe(headerRef.value);
    }
    if (surfaceRef.value) {
      resizeObserver.observe(surfaceRef.value);
    }
  });
});

onBeforeUnmount(() => {
  clearCollapseTimer();
  stopPointerStatePolling();
  resizeObserver?.disconnect();
  resizeObserver = null;
  window.removeEventListener("blur", collapseImmediately);
  window.removeEventListener("resize", syncPanelGeometry);
});
</script>
