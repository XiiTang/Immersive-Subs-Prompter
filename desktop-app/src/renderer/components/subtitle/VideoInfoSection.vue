<template>
  <section class="video-info-section">
    <section class="video-meta">
      <p class="video-meta__title">{{ title }}</p>
      <p class="video-meta__profile">{{ profileLabel }}</p>
      <p class="video-meta__url">{{ displayUrl }}</p>
    </section>
    <section class="control-panel" v-if="hasActiveVideo">
      <TrackSelector
        v-model="localPrimaryTrackId"
        :tracks="subtitleTracks"
        :placeholder="t('primary-track-placeholder', 'Primary Subtitle')"
        :aria-label="t('primary-track-placeholder', 'Primary Subtitle')"
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
    <div class="status-row" ref="statusRowRef" :style="{ '--status-row-max-height': statusRowMaxHeight }">
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
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import PlaybackControls from "./PlaybackControls.vue";
import StatusBanner from "./StatusBanner.vue";
import TrackSelector from "./TrackSelector.vue";
import TranscriptionControls from "./TranscriptionControls.vue";

interface SubtitleTrackOption {
  id: string;
  sourceFile: string;
}

interface StatusBannerState {
  text: string;
  modifier: string;
}

const {
  primaryTrackId,
  secondaryTrackId,
  activeTranscriptionId,
  statusBanner
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

const statusRowRef = useTemplateRef<HTMLElement>("statusRowRef");
const statusRowMaxHeight = ref("100vh");

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

function updateStatusRowMaxHeight() {
  nextTick(() => {
    const el = statusRowRef.value;
    if (!el) {
      return;
    }
    statusRowMaxHeight.value = `${el.scrollHeight}px`;
  });
}

watch(
  () => statusBanner,
  () => {
    updateStatusRowMaxHeight();
  },
  { deep: true, immediate: true }
);

onMounted(() => {
  window.addEventListener("resize", updateStatusRowMaxHeight);
  updateStatusRowMaxHeight();
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateStatusRowMaxHeight);
});
</script>
