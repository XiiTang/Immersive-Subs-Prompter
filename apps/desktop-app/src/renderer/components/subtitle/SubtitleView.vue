<template>
  <div class="subtitle-view">
    <TopControlPanel
      :title="titleText"
      :profile-label="profileLabel"
      :display-url="displayUrl"
      :subtitle-tracks="subtitleTracks"
      v-model:primary-track-id="primaryTrackId"
      v-model:secondary-track-id="secondaryTrackId"
      :transcription-enabled="transcriptionEnabled"
      :transcription-configs="transcriptionConfigs"
      v-model:active-transcription-id="activeTranscriptionId"
      :can-transcribe="canTranscribe"
      :is-transcribing="isTranscribing"
      :status-banner="statusBanner"
      :has-active-video="hasActiveVideo"
      :is-playing="isPlaying"
      :displayed-playback-time="displayedPlaybackTime"
      :playback-duration="playbackDuration"
      :slider-max="sliderMax"
      :slider-step="sliderStep"
      :slider-value="sliderValue"
      :slider-enabled="sliderEnabled"
      :slider-fill-style="sliderFillStyle"
      :auto-hide-enabled="autoHideEnabled"
      :format-source-file="formatTrackLabel"
      :t="t"
      @toggle-playback="togglePlayback"
      @start-transcription="startTranscription"
      @scrub-start="handleScrubStart"
      @scrub-input="handleScrubInput"
      @scrub-end="handleScrubEnd"
      @scrub-cancel="handleScrubCancel"
      @toggle-auto-hide="toggleAutoHide"
    />
    <TranscriptSurface
      :blocks="transcriptBlocks"
      :current-time="displayedPlaybackTime"
      :seek-request="seekRequest"
      :playback-loop="playbackLoop"
      :ab-loop-selection-state="abLoopSelectionState"
      :subtitle-panel-style="subtitlePanelStyle"
      :primary-font-family="transcriptPrimaryFontFamily"
      :primary-font-size="transcriptPrimaryFontSize"
      :secondary-font-family="transcriptSecondaryFontFamily"
      :secondary-font-size="transcriptSecondaryFontSize"
      :auto-hide-meta-row="subtitleAutoHideMetaRow"
      :line-height="transcriptLineHeight"
      :primary-secondary-gap="transcriptPrimarySecondaryGap"
      :block-gap="transcriptBlockGap"
      :primary-color="playbackProfileSettings.subtitlePrimaryColor"
      :secondary-color="playbackProfileSettings.subtitleSecondaryColor"
      :active-primary-color="playbackProfileSettings.subtitleActivePrimaryColor"
      :active-secondary-color="playbackProfileSettings.subtitleActiveSecondaryColor"
      :auto-scroll-delay-ms="autoScrollDelayMs"
      :scroll-position-ratio="scrollPositionRatio"
      :t="t"
      @play-cue="seekToCue"
      @loop-cue="toggleLoop"
      @loop-range="handleAbLoop"
      @word-hover="handleWordHover"
      @word-leave="handleWordLeave"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { normalizeSubtitleFontFamily } from "../../../common/subtitleFonts.js";
import {
  createAbLoopSelectionState,
  deriveAbLoopSelectionState,
  selectAbLoopCue
} from "./abLoopSelection";
import TopControlPanel from "../top-panel/TopControlPanel.vue";
import TranscriptSurface from "./TranscriptSurface.vue";
import { usePlaybackPrediction } from "./composables/usePlaybackPrediction";
import { usePlaybackScrubbing } from "./composables/usePlaybackScrubbing";
import { clamp, formatSourceFile } from "../../utils/formatters";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n.js";
import { DEFAULT_PROFILE_TEMPLATE, useDesktopStore } from "../../stores/desktop";
import { getLoopWindow, keepTimeInsideLoopWindow } from "./loopPlayback";
import type { TranscriptBlock, TranscriptSeekRequest } from "./transcript/types";
import { TRANSCRIPTION_PLUGIN_ID, WORD_LOOKUP_PLUGIN_ID } from "../../../common/pluginIds.js";
import type { WordHoverPayload, WordLeavePayload, WordLookupResult } from "../../plugins/wordLookupTypes";

const store = useDesktopStore();
const EMPTY_CUES: ReadonlyArray<{ start: number; end: number; text: string }> = [];
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const subtitleTracks = computed(() => store.subtitleTracks);
const transcriptionState = computed(() => store.transcriptionState);
const transcriptionEnabled = computed(() => store.isPluginEnabled(TRANSCRIPTION_PLUGIN_ID));
const wordLookupEnabled = computed(() => store.isPluginEnabled(WORD_LOOKUP_PLUGIN_ID));
const wordLookupConfig = computed(() => store.getWordLookupPluginConfig());
const transcriptionPluginConfig = computed(() => store.getTranscriptionPluginConfig());
const transcriptionConfigs = computed(() => (
  transcriptionEnabled.value ? transcriptionPluginConfig.value.configs : []
));
const transcriptionConfigNames = computed(() =>
  transcriptionConfigs.value
    .map((config: any) => config.name?.trim())
    .filter((name: any): name is string => Boolean(name))
);

const subtitlePanelOpacity = computed(() => {
  const value = store.panelOpacity;
  const clamped = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 100;
  return (clamped / 100).toFixed(2);
});
const subtitlePanelStyle = computed(() => ({
  "--panel-opacity-factor": subtitlePanelOpacity.value
}));

const playbackProfileSettings = computed(
  () => store.activeProfile?.settings ?? DEFAULT_PROFILE_TEMPLATE
);
const MIN_SUBTITLE_FONT_SIZE = 3;
const MAX_SUBTITLE_FONT_SIZE = 96;

function normalizeSubtitleFontSize(value: number | null | undefined, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(MAX_SUBTITLE_FONT_SIZE, Math.max(MIN_SUBTITLE_FONT_SIZE, Math.round(numeric)));
}

const transcriptPrimaryFontFamily = computed(() =>
  normalizeSubtitleFontFamily(playbackProfileSettings.value.primarySubtitleFontFamily)
);
const transcriptPrimaryFontSize = computed(() =>
  normalizeSubtitleFontSize(
    playbackProfileSettings.value.primarySubtitleFontSize,
    DEFAULT_PROFILE_TEMPLATE.primarySubtitleFontSize
  )
);
const transcriptSecondaryFontFamily = computed(() =>
  normalizeSubtitleFontFamily(playbackProfileSettings.value.secondarySubtitleFontFamily)
);
const transcriptSecondaryFontSize = computed(() =>
  normalizeSubtitleFontSize(
    playbackProfileSettings.value.secondarySubtitleFontSize,
    DEFAULT_PROFILE_TEMPLATE.secondarySubtitleFontSize
  )
);
const subtitleAutoHideMetaRow = computed(() => playbackProfileSettings.value.subtitleAutoHideMetaRow);
const transcriptLineHeight = computed(() => Math.max(playbackProfileSettings.value.subtitleLineHeight, 1));
const transcriptPrimarySecondaryGap = computed(() =>
  Math.max(playbackProfileSettings.value.subtitlePrimarySecondaryGap, 0)
);
const transcriptBlockGap = computed(() =>
  Math.max(playbackProfileSettings.value.subtitleBlockGap, 0)
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

const primaryTrackId = computed({
  get: () => store.desktopState?.selectedPrimarySubtitleId ?? "",
  set: (value: string) => store.selectSubtitleTrack(value || null, "primary")
});

const secondaryTrackId = computed({
  get: () => store.desktopState?.selectedSecondarySubtitleId ?? "",
  set: (value: string) => store.selectSubtitleTrack(value || null, "secondary")
});

const transcriptBlocks = computed<TranscriptBlock[]>(() => store.transcriptBlocks);
const primaryCues = computed(() => store.desktopState?.primarySubtitles?.cues ?? EMPTY_CUES);
const secondaryCues = computed(() => store.desktopState?.secondarySubtitles?.cues ?? EMPTY_CUES);
const playback = computed(() => store.playback ?? store.desktopState?.playback);
const playbackLoop = computed(() => playback.value?.loop ?? null);
const abLoopSelectionState = ref(createAbLoopSelectionState());
const seekRequestToken = ref(0);
const seekRequest = ref<TranscriptSeekRequest | null>(null);
const wordLookupRequestToken = ref(0);
const wordLookupOpenedRequestToken = ref(0);
const wordLookupTriggerLeftRequestToken = ref<number | null>(null);
const hoveredWordPayload = ref<WordHoverPayload | null>(null);

watch([
  () => store.desktopState?.selectedPrimarySubtitleId,
  () => store.desktopState?.selectedSecondarySubtitleId,
  primaryCues,
  secondaryCues
], () => {
  abLoopSelectionState.value = createAbLoopSelectionState();
});
watch(playbackLoop, (loop) => {
  if (loop?.mode === "ab") {
    abLoopSelectionState.value = deriveAbLoopSelectionState(loop);
    return;
  }

  if (abLoopSelectionState.value.kind === "active") {
    abLoopSelectionState.value = createAbLoopSelectionState();
  }
}, { immediate: true });
const hasActiveVideo = computed(() => Boolean(store.desktopState?.videoUrl));
const isPlaying = computed(() => Math.abs(playback.value?.playbackRate ?? 0) > 0);
const autoHideEnabled = computed(() => store.settings?.global.autoHidePanels ?? false);

const playbackDuration = computed(() => {
  const duration = playback.value?.duration;
  if (typeof duration === "number" && duration > 0) {
    return duration;
  }
  const primaryCues = store.desktopState?.primarySubtitles?.cues ?? [];
  const secondaryCues = store.desktopState?.secondarySubtitles?.cues ?? [];
  const primaryEnd = primaryCues.length ? primaryCues[primaryCues.length - 1]?.end ?? 0 : 0;
  const secondaryEnd = secondaryCues.length ? secondaryCues[secondaryCues.length - 1]?.end ?? 0 : 0;
  const fallback = Math.max(primaryEnd, secondaryEnd);
  return fallback > 0 ? fallback : null;
});

const sliderMax = computed(() => (playbackDuration.value && playbackDuration.value > 0 ? playbackDuration.value : 1));
const sliderStep = computed(() => {
  const duration = playbackDuration.value;
  if (!duration || duration <= 0) {
    return 1000;
  }
  return Math.max(40, Math.round(duration / 1500));
});
const sliderEnabled = computed(() => Boolean(playbackDuration.value && playbackDuration.value > 0));

const {
  predictedTime,
  setManualSeekBaseline,
  startPredictionLoop
} = usePlaybackPrediction(playback);

function handleSeek(time: number) {
  issueSeekRequest(time);
  setManualSeekBaseline(time, playback.value?.playbackRate ?? 0);
  startPredictionLoop();
  store.controlVideo({ type: "seek", time });
}

function issueSeekRequest(time: number) {
  seekRequestToken.value += 1;
  seekRequest.value = {
    token: seekRequestToken.value,
    time
  };
}

const { isScrubbing, scrubbedTime, handleScrubStart, handleScrubInput, handleScrubEnd, handleScrubCancel } =
  usePlaybackScrubbing({
    sliderEnabled,
    sliderMax,
    onSeek: handleSeek
  });

const displayedPlaybackTime = computed(() => {
  const baseTime =
    isScrubbing.value && scrubbedTime.value !== null
      ? scrubbedTime.value
      : predictedTime.value ?? playback.value?.currentTime ?? 0;
  const safeBase = Number.isFinite(baseTime) ? baseTime : 0;
  const loopWindow = getLoopWindow(playbackLoop.value);
  const boundedBase =
    loopWindow !== null
      ? keepTimeInsideLoopWindow({
        time: safeBase,
        start: loopWindow.start,
        end: loopWindow.end,
        mode: loopWindow.mode
      })
      : safeBase;
  const duration = playbackDuration.value;
  if (!duration || duration <= 0) {
    return Math.max(0, boundedBase);
  }
  return clamp(boundedBase, 0, duration);
});

const sliderValue = computed(() => displayedPlaybackTime.value);
const sliderFillStyle = computed(() => {
  const percent =
    sliderEnabled.value && sliderMax.value > 0
      ? clamp((sliderValue.value / sliderMax.value) * 100, 0, 100)
      : 0;
  const stop = Number.isFinite(percent) ? percent : 0;
  return {
    "--slider-progress": `${stop}%`
  };
});

const activeTranscriptionId = computed({
  get: () => transcriptionPluginConfig.value.activeConfigId ?? transcriptionConfigs.value[0]?.id ?? "",
  set: (value: string) => {
    const configs = transcriptionPluginConfig.value.configs;
    const nextActiveId = configs.some((config) => config.id === value) ? value : configs[0]?.id ?? null;
    store.setPluginConfig(TRANSCRIPTION_PLUGIN_ID, {
      ...transcriptionPluginConfig.value,
      activeConfigId: nextActiveId
    });
  }
});
const isTranscribing = computed(() => transcriptionState.value?.status === "running");
const canTranscribe = computed(() => {
  if (!transcriptionEnabled.value) {
    return false;
  }
  if (!transcriptionConfigs.value.length) {
    return false;
  }
  const state = store.desktopState;
  if (!state || !state.videoUrl) {
    return false;
  }
  return state.activeSource !== "mediaserver";
});

async function startTranscription() {
  await store.startTranscription();
}

function formatTrackLabel(sourceFile: string): string {
  return formatSourceFile(sourceFile, transcriptionConfigNames.value);
}

const statusBanner = computed(() => {
  const transState = transcriptionState.value;
  if (transState) {
    if (transState.status === "running") {
      return {
        text: transState.message || t("transcription-status-running", "Transcribing..."),
        tone: "info" as const
      };
    }
    if (transState.status === "error") {
      return {
        text: transState.message || t("transcription-status-error", "Transcription failed"),
        tone: "danger" as const
      };
    }
  }

  const state = store.desktopState;
  if (!state) {
    return { text: t("status-initializing", "Initializing..."), tone: "info" as const };
  }

  switch (state.status) {
    case "idle":
      return { text: t("status-idle", "Waiting for extension connection..."), tone: "info" as const };
    case "awaiting-video":
      return { text: t("status-awaiting-video", "Open a supported video in your browser"), tone: "info" as const };
    case "loading-subtitles":
      return { text: t("status-loading-subtitles", "Downloading subtitles..."), tone: "info" as const };
    case "ready":
      if (transState?.status === "success") {
        return {
          text: t("transcription-status-success", "Transcription finished"),
          tone: "success" as const
        };
      }
      return { text: t("status-ready", "Subtitles loaded"), tone: "success" as const };
    case "error":
      return {
        text: state.error
          ? `${t("status-error", "Subtitle loading failed")}: ${state.error}`
          : t("status-error", "Subtitle loading failed"),
        tone: "danger" as const
      };
    default:
      return { text: t("status-unknown", "Unknown status"), tone: "warning" as const };
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
    return `${profileName} (${t("profile-rule-label", "Rule")}: ${store.desktopState.appliedRulePattern})`;
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

function togglePlayback() {
  if (!hasActiveVideo.value) {
    return;
  }
  const nextCommand = isPlaying.value ? "pause" : "play";
  store.controlVideo({ type: nextCommand });
}

function seekToCue(index: number) {
  const cue = primaryCues.value[index];
  if (!cue) return;
  issueSeekRequest(cue.start);
  store.controlVideo({ type: "seek", time: cue.start });
}

function toggleLoop(index: number) {
  const cue = primaryCues.value[index];
  if (!cue) return;
  abLoopSelectionState.value = createAbLoopSelectionState();
  const isActive = playbackLoop.value?.mode === "single" && playbackLoop.value.startCueIndex === index;
  if (isActive) {
    store.controlVideo({ type: "stopLoop" });
  } else {
    store.controlVideo({
      type: "loop",
      loop: {
        mode: "single",
        startMs: cue.start,
        endMs: cue.end,
        startCueIndex: index,
        endCueIndex: index,
        anchorCueIndex: index,
        origin: "single-loop"
      }
    });
  }
}

function handleAbLoop(index: number) {
  const result = selectAbLoopCue(
    abLoopSelectionState.value,
    index,
    (cueIndex) => {
      const cue = primaryCues.value[cueIndex];
      if (!cue) {
        return null;
      }
      return { start: cue.start, end: cue.end };
    }
  );

  abLoopSelectionState.value = result.state;

  if (result.state.kind === "selecting-second" && playbackLoop.value !== null) {
    store.controlVideo({ type: "stopLoop" });
  }

  if (result.loop) {
    store.controlVideo({ type: "loop", loop: result.loop });
  }
}

function toggleAutoHide() {
  store.updateGlobalSetting("autoHidePanels", !autoHideEnabled.value);
}

function isWordLookupModifierPressed(payload: Pick<WordHoverPayload, "altKey" | "ctrlKey" | "metaKey" | "shiftKey">): boolean {
  switch (wordLookupConfig.value.modifierKey) {
    case "ctrl":
      return payload.ctrlKey || payload.metaKey;
    case "shift":
      return payload.shiftKey;
    case "alt":
    default:
      return payload.altKey;
  }
}

async function handleWordHover(payload: WordHoverPayload) {
  hoveredWordPayload.value = payload;
  if (!wordLookupEnabled.value || !isWordLookupModifierPressed(payload)) {
    return;
  }
  await openWordLookupWindow(payload);
}

async function openWordLookupWindow(payload: WordHoverPayload) {
  const requestId = wordLookupRequestToken.value + 1;
  wordLookupRequestToken.value = requestId;
  wordLookupOpenedRequestToken.value = 0;
  wordLookupTriggerLeftRequestToken.value = null;
  const result = await window.usp.lookupWord(payload.token) as WordLookupResult;
  if (requestId !== wordLookupRequestToken.value) {
    return;
  }
  if (!result.matches.length) {
    return;
  }
  await window.usp.openWordLookupWindow({
    anchorRect: payload.anchorRect,
    panelSize: wordLookupConfig.value.panelSize,
    matches: result.matches
  });
  wordLookupOpenedRequestToken.value = requestId;
  if (
    wordLookupTriggerLeftRequestToken.value === requestId ||
    hoveredWordPayload.value?.token !== payload.token
  ) {
    void window.usp.notifyWordLookupTriggerLeave();
  }
}

function handleWordLeave(payload: WordLeavePayload) {
  if (hoveredWordPayload.value?.hoverId === payload.hoverId) {
    const requestId = wordLookupRequestToken.value;
    hoveredWordPayload.value = null;
    if (wordLookupOpenedRequestToken.value === requestId) {
      void window.usp.notifyWordLookupTriggerLeave();
    } else {
      wordLookupTriggerLeftRequestToken.value = requestId;
    }
  }
}

function handleWordLookupKeyDown(event: KeyboardEvent) {
  if (event.repeat || !wordLookupEnabled.value || !hoveredWordPayload.value) {
    return;
  }
  const payload = {
    ...hoveredWordPayload.value,
    altKey: event.altKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
    shiftKey: event.shiftKey
  };
  if (!isWordLookupModifierPressed(payload)) {
    return;
  }
  void openWordLookupWindow(payload);
}

onMounted(() => {
  window.addEventListener("keydown", handleWordLookupKeyDown);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleWordLookupKeyDown);
});
</script>
