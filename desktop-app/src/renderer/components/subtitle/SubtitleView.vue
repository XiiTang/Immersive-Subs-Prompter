<template>
  <div class="subtitle-view">
    <VideoInfoSection
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
      :loop-cue-index="loopCueIndex"
      :active-ab-loop-range="activeAbLoopRange"
      :ab-loop-start-cue-index="abLoopStartCueIndex"
      :subtitle-panel-style="subtitlePanelStyle"
      :font-family="transcriptFontFamily"
      :font-size="transcriptFontSize"
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
      @play-cue="seekToCue"
      @loop-cue="toggleLoop"
      @loop-range="handleAbLoop"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { normalizeSubtitleFontFamily } from "../../../common/subtitleFonts.js";
import TranscriptSurface from "./TranscriptSurface.vue";
import VideoInfoSection from "./VideoInfoSection.vue";
import { usePlaybackPrediction } from "./composables/usePlaybackPrediction";
import { usePlaybackScrubbing } from "./composables/usePlaybackScrubbing";
import { clamp, formatSourceFile } from "../../utils/formatters";
import { DEFAULT_LANGUAGE, useI18n } from "../../i18n.js";
import { DEFAULT_PROFILE_TEMPLATE, useDesktopStore } from "../../stores/desktop";
import type { ActiveAbLoopRange, TranscriptBlock, TranscriptSeekRequest } from "./transcript/types";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const subtitleTracks = computed(() => store.subtitleTracks);
const transcriptionState = computed(() => store.transcriptionState);
const transcriptionEnabled = computed(() => store.settings?.transcription.enabled ?? true);
const transcriptionConfigs = computed(() => store.settings?.transcription.configs ?? []);
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
const transcriptFontFamily = computed(() => normalizeSubtitleFontFamily(playbackProfileSettings.value.subtitleFontFamily));
const transcriptFontSize = computed(() => Math.max(playbackProfileSettings.value.subtitleFontSize, 12));
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
const primaryCues = computed(() => store.desktopState?.primarySubtitles?.cues ?? []);
const secondaryCues = computed(() => store.desktopState?.secondarySubtitles?.cues ?? []);
const playback = computed(() => store.playback ?? store.desktopState?.playback);
const loopCueIndex = computed(() => playback.value?.loopCueIndex ?? null);
const abLoopStartCueIndex = ref<number | null>(null);
const activeAbLoopRange = ref<ActiveAbLoopRange | null>(null);
const seekRequestToken = ref(0);
const seekRequest = ref<TranscriptSeekRequest | null>(null);

watch([
  () => store.desktopState?.selectedPrimarySubtitleId,
  () => store.desktopState?.selectedSecondarySubtitleId,
  primaryCues,
  secondaryCues
], () => {
  abLoopStartCueIndex.value = null;
  activeAbLoopRange.value = null;
});
watch(() => playback.value?.isLooping, (isLooping) => {
  if (!isLooping) {
    activeAbLoopRange.value = null;
  }
});
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
  const duration = playbackDuration.value;
  if (!duration || duration <= 0) {
    return Math.max(0, safeBase);
  }
  return clamp(safeBase, 0, duration);
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
  get: () =>
    store.settings?.transcription.activeConfigId ?? transcriptionConfigs.value[0]?.id ?? "",
  set: (value: string) => store.setActiveTranscriptionConfig(value)
});
const isTranscribing = computed(() => transcriptionState.value?.status === "running");
const canTranscribe = computed(() => {
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

  switch (state.status) {
    case "idle":
      return { text: t("status-idle", "Waiting for extension connection..."), modifier: "" };
    case "awaiting-video":
      return { text: t("status-awaiting-video", "Open a supported video in your browser"), modifier: "" };
    case "loading-subtitles":
      return { text: t("status-loading-subtitles", "Downloading subtitles..."), modifier: "" };
    case "ready":
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
  abLoopStartCueIndex.value = null;
  activeAbLoopRange.value = null;
  const isActive = loopCueIndex.value === index;
  if (isActive) {
    store.controlVideo({ type: "stopLoop" });
  } else {
    store.controlVideo({ type: "loop", start: cue.start, end: cue.end, cueIndex: index });
  }
}

function handleAbLoop(index: number) {
  const endCue = primaryCues.value[index];
  if (!endCue) {
    return;
  }

  if (abLoopStartCueIndex.value === null) {
    abLoopStartCueIndex.value = index;
    activeAbLoopRange.value = null;
    if (playback.value?.isLooping) {
      store.controlVideo({ type: "stopLoop" });
    }
    return;
  }

  if (abLoopStartCueIndex.value === index) {
    abLoopStartCueIndex.value = null;
    activeAbLoopRange.value = null;
    return;
  }

  const startIndex = abLoopStartCueIndex.value;
  const startCue = primaryCues.value[startIndex];
  if (!startCue) {
    abLoopStartCueIndex.value = null;
    activeAbLoopRange.value = null;
    return;
  }

  let loopStart = startCue.start;
  let loopEnd = endCue.end;
  let loopCueIndex = startIndex;

  if (loopEnd <= loopStart) {
    loopStart = Math.min(startCue.start, endCue.start);
    loopEnd = Math.max(startCue.end, endCue.end);
    loopCueIndex = loopStart === startCue.start ? startIndex : index;
  }

  if (loopEnd <= loopStart) {
    const fallbackDuration = Math.max(
      startCue.end - startCue.start,
      endCue.end - endCue.start,
      500
    );
    loopEnd = loopStart + Math.max(fallbackDuration, 1);
  }

  activeAbLoopRange.value = {
    startCueIndex: Math.min(startIndex, index),
    endCueIndex: Math.max(startIndex, index)
  };
  store.controlVideo({ type: "loop", start: loopStart, end: loopEnd, cueIndex: loopCueIndex });
  abLoopStartCueIndex.value = null;
}

function toggleAutoHide() {
  store.updateGlobalSetting("autoHidePanels", !autoHideEnabled.value);
}
</script>
