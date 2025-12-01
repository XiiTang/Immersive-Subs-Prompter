<template>
  <div class="subtitle-view">
    <section class="video-info-section">
      <section class="video-meta">
        <p class="video-meta__title">{{ titleText }}</p>
        <p class="video-meta__profile">{{ profileLabel }}</p>
        <p class="video-meta__url">{{ displayUrl }}</p>
      </section>
      <section class="control-panel" v-if="subtitleTracks.length">
        <label class="track-picker">
          <select v-model="primaryTrackId" aria-label="Primary Subtitle">
            <option disabled value="">{{ t("primary-track-placeholder", "Primary Subtitle") }}</option>
            <option v-for="track in subtitleTracks" :key="track.id" :value="track.id">
              {{ formatSourceFile(track.sourceFile) }}
            </option>
          </select>
        </label>
        <label class="track-picker">
          <select v-model="secondaryTrackId" aria-label="Secondary Subtitle">
            <option value="">{{ t("secondary-track-none", "None") }}</option>
            <option v-for="track in subtitleTracks" :key="track.id" :value="track.id">
              {{ formatSourceFile(track.sourceFile) }}
            </option>
          </select>
        </label>
        <div class="playback-buttons">
          <button id="play-btn" type="button" @click="handlePlay">
            {{ t("play-button", "Play") }}
          </button>
          <button id="pause-btn" type="button" @click="handlePause">
            {{ t("pause-button", "Pause") }}
          </button>
        </div>
      </section>
      <div
        class="status-row"
        ref="statusRowRef"
        :style="{ '--status-row-max-height': statusRowMaxHeight }"
      >
        <section class="status-banner" :class="statusBanner.modifier">
          <span>{{ statusBanner.text }}</span>
        </section>
        <button
          type="button"
          class="auto-hide-toggle"
          :aria-pressed="autoHideEnabled"
          aria-label="Toggle auto hide panels"
          @click="toggleAutoHide"
        >
          {{ autoHideEnabled ? "▲" : "▼" }}
        </button>
      </div>
    </section>
    <section class="subtitle-scroll-section">
      <section class="subtitle-list" ref="subtitleListEl">
        <template v-if="cues.length">
          <div
            v-for="(cue, index) in cues"
            :key="`${cue.start}-${index}`"
            class="subtitle-item"
            :class="{
              'subtitle-item--active': index === activeCueIndex,
              'subtitle-item--auto-hide-time': autoHideTimestamps
            }"
            :ref="(el: any) => setCueRef(el, index)"
          >
            <div class="subtitle-item__time">
              <span>{{ formatTime(cue.start) }} - {{ formatTime(cue.end) }}</span>
              <button
                class="subtitle-item__play-btn"
                type="button"
                :aria-label="`Play from cue ${index + 1}`"
                @click="seekToCue(index)"
              >
                ▶
              </button>
              <button
                class="subtitle-item__loop-btn"
                type="button"
                :class="{ 'subtitle-item__loop-btn--active': index === loopCueIndex }"
                :aria-label="`Loop cue ${index + 1}`"
                @click="toggleLoop(index)"
              >
                ↻
              </button>
            </div>
            <div class="subtitle-item__text">
              <div class="subtitle-item__text-primary" v-html="formatCueText(cue.primaryText)"></div>
              <div
                v-if="cue.secondaryText"
                class="subtitle-item__text-secondary"
                v-html="formatCueText(cue.secondaryText)"
              ></div>
            </div>
          </div>
        </template>
      </section>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onBeforeUpdate, onMounted, ref, watch } from "vue";
import { useDesktopStore, DEFAULT_PROFILE_TEMPLATE } from "../stores/desktop";
import type { CombinedCue } from "../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../i18n.js";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const subtitleTracks = computed(() => store.subtitleTracks);
const transcriptionState = computed(() => store.transcriptionState);
const subtitleListEl = ref<HTMLElement | null>(null);
const statusRowRef = ref<HTMLElement | null>(null);
const cueRefs = ref<HTMLElement[]>([]);
const autoScrollEnabled = ref(true);
const isPointerDown = ref(false);
const hasSubtitleSelection = ref(false);
let autoScrollTimer: number | null = null;
let predictionFrame: number | null = null;
const predictedTime = ref<number | null>(null);
const statusRowMaxHeight = ref("100vh");

onBeforeUpdate(() => {
  cueRefs.value = [];
});

const playbackProfileSettings = computed(
  () => store.activeProfile?.settings ?? DEFAULT_PROFILE_TEMPLATE
);

const autoScrollDelayMs = computed(
  () =>
    Math.max(
      0,
      (playbackProfileSettings.value.subtitleAutoScrollTimeout ??
        DEFAULT_PROFILE_TEMPLATE.subtitleAutoScrollTimeout) * 1000
    )
);

const scrollPositionRatio = computed(() => {
  const percent =
    playbackProfileSettings.value.subtitleScrollPosition ??
    DEFAULT_PROFILE_TEMPLATE.subtitleScrollPosition;
  return clamp(percent, 0, 100) / 100;
});

function setCueRef(el: Element | null, index: number) {
  if (el) {
    cueRefs.value[index] = el as HTMLElement;
  }
}

const primaryTrackId = computed({
  get: () => store.desktopState?.selectedPrimarySubtitleId ?? "",
  set: (value: string) => store.selectSubtitleTrack(value || null, "primary")
});

const secondaryTrackId = computed({
  get: () => store.desktopState?.selectedSecondarySubtitleId ?? "",
  set: (value: string) => store.selectSubtitleTrack(value || null, "secondary")
});

const cues = computed<CombinedCue[]>(() => store.combinedCues);
const playback = computed(() => store.playback ?? store.desktopState?.playback);
const loopCueIndex = computed(() => playback.value?.loopCueIndex ?? null);
const autoHideEnabled = computed(() => store.settings?.global.autoHidePanels ?? false);
const autoHideTimestamps = computed(() => store.settings?.global.autoHideTimestamps ?? false);

const activeCueIndex = computed(() => {
  if (playback.value?.isLooping && loopCueIndex.value !== null) {
    return loopCueIndex.value;
  }
  const currentTime = predictedTime.value ?? playback.value?.currentTime;
  if (currentTime === undefined || currentTime === null) {
    return null;
  }
  const index = cues.value.findIndex((cue) => currentTime >= cue.start && currentTime <= cue.end);
  return index === -1 ? null : index;
});

function formatSourceFile(sourceFile: string): string {
  const dotIndex = sourceFile.indexOf(".");
  if (dotIndex === -1) {
    return sourceFile;
  }
  const prefix = sourceFile.slice(0, dotIndex);
  const trimmed = sourceFile.slice(dotIndex + 1);
  const cleanPrefix = prefix.replace(/-/g, "");
  const looksLikeHash = cleanPrefix.length >= 16 && /^[a-f0-9]+$/i.test(cleanPrefix);
  if (looksLikeHash && trimmed) {
    return trimmed;
  }
  return sourceFile;
}

const statusBanner = computed(() => {
  // Priority 1: Transcription Status (Active/Error)
  const transState = transcriptionState.value;
  if (transState) {
    if (transState.status === "running") {
      return {
        text: transState.message || t("transcription-status-running", "Transcribing..."),
        modifier: "status-banner--running"
      };
    }
    if (transState.status === "error") {
      return {
        text: transState.message || t("transcription-status-error", "Transcription failed"),
        modifier: "status-banner--error"
      };
    }
  }

  const state = store.desktopState;
  if (!state) {
    return { text: t("status-initializing", "Initializing..."), modifier: "" };
  }

  // Priority 2: Main Application Status
  switch (state.status) {
    case "idle":
      return { text: t("status-idle", "Waiting for extension connection..."), modifier: "" };
    case "awaiting-video":
      return { text: t("status-awaiting-video", "Open a supported video in your browser"), modifier: "" };
    case "loading-subtitles":
      return { text: t("status-loading-subtitles", "Downloading subtitles..."), modifier: "" };
    case "ready":
      // Priority 3: Transcription Success (only if main status is ready)
      if (transState?.status === "success") {
        return {
          text: t("transcription-status-success", "Transcription finished"),
          modifier: "status-banner--success"
        };
      }
      return { text: t("status-ready", "Subtitles loaded"), modifier: "status-banner--ready" };
    case "error":
      return {
        text: state.error
          ? `${t("status-error", "Subtitle loading failed")}: ${state.error}`
          : t("status-error", "Subtitle loading failed"),
        modifier: "status-banner--error"
      };
    default:
      return { text: t("status-unknown", "Unknown status"), modifier: "" };
  }
});

const titleText = computed(
  () =>
    store.desktopState?.title ??
    (store.initError
      ? t("status-failed-init", "Failed to get initial state: {error}", { error: store.initError })
      : t("status-waiting-video", "Waiting for video..."))
);

const profileLabel = computed(() => {
  const profileName = store.desktopState?.appliedProfileName ?? store.activeProfile?.name ?? "Profile";
  if (store.desktopState?.appliedRulePattern) {
    return `${profileName} (Rule: ${store.desktopState.appliedRulePattern})`;
  }
  return `${t("active-profile-prefix", "Profile")}: ${profileName}`;
});

const displayUrl = computed(() => {
  const url = store.desktopState?.videoUrl ?? "";
  if (url.length > 60) {
    return `${url.slice(0, 57)}...`;
  }
  return url;
});

function formatCueText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br />");
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor((milliseconds ?? 0) / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function handlePlay() {
  store.controlVideo({ type: "play" });
}

function handlePause() {
  store.controlVideo({ type: "pause" });
}

function seekToCue(index: number) {
  const cue = cues.value[index];
  if (!cue) return;
  store.controlVideo({ type: "seek", time: cue.start });
}

function toggleLoop(index: number) {
  const cue = cues.value[index];
  if (!cue) return;
  const isActive = loopCueIndex.value === index;
  if (isActive) {
    store.controlVideo({ type: "stopLoop" });
  } else {
    store.controlVideo({ type: "loop", start: cue.start, end: cue.end, cueIndex: index });
  }
}

function toggleAutoHide() {
  store.updateGlobalSetting("autoHidePanels", !autoHideEnabled.value);
}

function updateStatusRowMaxHeight() {
  nextTick(() => {
    const el = statusRowRef.value;
    if (!el) {
      return;
    }
    statusRowMaxHeight.value = `${el.scrollHeight}px`;
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clearAutoScrollTimer() {
  if (autoScrollTimer !== null) {
    window.clearTimeout(autoScrollTimer);
    autoScrollTimer = null;
  }
}

function pauseAutoScroll() {
  autoScrollEnabled.value = false;
  clearAutoScrollTimer();
}

function scheduleAutoScrollRestore() {
  clearAutoScrollTimer();
  if (hasSubtitleSelection.value || isPointerDown.value) {
    return;
  }
  autoScrollTimer = window.setTimeout(() => {
    autoScrollEnabled.value = true;
    autoScrollTimer = null;
    nextTick(() => scrollToActiveCue("smooth"));
  }, autoScrollDelayMs.value);
}

function pauseAutoScrollTemporarily() {
  pauseAutoScroll();
  scheduleAutoScrollRestore();
}

function hasSelectionInsideList(): boolean {
  const selection = window.getSelection();
  const container = subtitleListEl.value;
  if (!selection || !container || selection.isCollapsed) {
    return false;
  }
  const contains = (node: Node | null) => Boolean(node && container.contains(node));
  return contains(selection.anchorNode) || contains(selection.focusNode);
}

function handleSelectionChange() {
  const isSelecting = hasSelectionInsideList();
  if (isSelecting) {
    hasSubtitleSelection.value = true;
    pauseAutoScroll();
    return;
  }
  if (hasSubtitleSelection.value) {
    hasSubtitleSelection.value = false;
    if (!isPointerDown.value) {
      scheduleAutoScrollRestore();
    }
  }
}

function handlePointerDown(event: MouseEvent) {
  if (event.button !== 0) {
    return;
  }
  const target = event.target as HTMLElement | null;
  if (target?.closest("button")) {
    return;
  }
  isPointerDown.value = true;
  pauseAutoScroll();
}

function handlePointerUp(event: MouseEvent) {
  if (!isPointerDown.value || event.button !== 0) {
    return;
  }
  isPointerDown.value = false;
  handleSelectionChange();
  if (!hasSubtitleSelection.value) {
    scheduleAutoScrollRestore();
  }
}

function scrollToActiveCue(behavior: ScrollBehavior = "smooth") {
  if (!autoScrollEnabled.value) {
    return;
  }
  const index = activeCueIndex.value;
  const container = subtitleListEl.value;
  if (index === null || !container) {
    return;
  }
  const target = cueRefs.value[index];
  if (!target) {
    return;
  }
  const targetTop =
    target.offsetTop - container.clientHeight * scrollPositionRatio.value + target.offsetHeight / 2;
  container.scrollTo({
    top: targetTop,
    behavior
  });
}

watch(activeCueIndex, (next, prev) => {
  if (next === null || !autoScrollEnabled.value) {
    return;
  }
  const behavior: ScrollBehavior = prev === null ? "auto" : "smooth";
  nextTick(() => scrollToActiveCue(behavior));
});

watch(
  cues,
  () => {
    if (autoScrollEnabled.value && activeCueIndex.value !== null) {
      nextTick(() => scrollToActiveCue("auto"));
    }
  },
  { deep: false }
);

watch(
  () => playbackProfileSettings.value.subtitleScrollPosition,
  () => {
    if (autoScrollEnabled.value && activeCueIndex.value !== null) {
      nextTick(() => scrollToActiveCue("auto"));
    }
  }
);

watch(autoScrollDelayMs, () => {
  if (!autoScrollEnabled.value && autoScrollTimer !== null) {
    scheduleAutoScrollRestore();
  }
});

watch(
  statusBanner,
  () => {
    updateStatusRowMaxHeight();
  },
  { deep: true, immediate: true }
);

function computePredictedTime(now = Date.now()): number | null {
  const state = playback.value;
  if (!state || state.currentTime === undefined || state.currentTime === null) {
    return null;
  }
  if (!state.lastUpdate || state.playbackRate === 0) {
    return state.currentTime;
  }
  const elapsed = Math.max(0, now - state.lastUpdate);
  return state.currentTime + elapsed * state.playbackRate;
}

function stopPredictionLoop() {
  if (predictionFrame !== null) {
    cancelAnimationFrame(predictionFrame);
    predictionFrame = null;
  }
}

function startPredictionLoop() {
  stopPredictionLoop();
  const step = () => {
    predictedTime.value = computePredictedTime();
    if (playback.value?.playbackRate && playback.value.playbackRate !== 0) {
      predictionFrame = requestAnimationFrame(step);
    } else {
      predictionFrame = null;
    }
  };
  // Seed the initial prediction immediately
  predictedTime.value = computePredictedTime();
  if (playback.value?.playbackRate && playback.value.playbackRate !== 0) {
    predictionFrame = requestAnimationFrame(step);
  }
}

watch(
  playback,
  () => {
    startPredictionLoop();
  },
  { immediate: true }
);

onMounted(() => {
  const list = subtitleListEl.value;
  list?.addEventListener("wheel", pauseAutoScrollTemporarily, { passive: true });
  list?.addEventListener("touchmove", pauseAutoScrollTemporarily, { passive: true });
  list?.addEventListener("mousedown", handlePointerDown);
  window.addEventListener("mouseup", handlePointerUp);
  document.addEventListener("selectionchange", handleSelectionChange);
  window.addEventListener("resize", updateStatusRowMaxHeight);
  updateStatusRowMaxHeight();
});

onBeforeUnmount(() => {
  const list = subtitleListEl.value;
  list?.removeEventListener("wheel", pauseAutoScrollTemporarily);
  list?.removeEventListener("touchmove", pauseAutoScrollTemporarily);
  list?.removeEventListener("mousedown", handlePointerDown);
  window.removeEventListener("mouseup", handlePointerUp);
  document.removeEventListener("selectionchange", handleSelectionChange);
  window.removeEventListener("resize", updateStatusRowMaxHeight);
  clearAutoScrollTimer();
  stopPredictionLoop();
});
</script>

<style scoped>
.subtitle-item--auto-hide-time .subtitle-item__time {
  opacity: 0;
  transition: opacity 0.2s ease;
}

.subtitle-item--auto-hide-time:hover .subtitle-item__time {
  opacity: 1;
}
</style>
