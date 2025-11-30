<template>
  <header class="window__header">
    <div class="window__title">Immersive Subs Prompter</div>
    <div class="window__status">{{ connectionText }}</div>
  <div class="window__header-actions">
      <div class="transcription-inline">
        <select class="transcription-select" v-model="activeTranscriptionId">
          <option v-for="config in transcriptionConfigs" :key="config.id" :value="config.id">
            {{ config.name || config.id }}
          </option>
        </select>
        <button
          class="icon-button"
          type="button"
          :disabled="!canTranscribe || isTranscribing"
          :title="isTranscribing ? t('transcription-button-running', 'Transcribing...') : t('transcription-button-start', 'Start Transcription')"
          @click="startTranscription"
        >
          <span aria-hidden="true">{{ isTranscribing ? '⏳' : '▶' }}</span>
        </button>

      </div>
      <div class="transparency-inline">
        <input
          class="slider header-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          v-model.number="panelOpacityValue"
          aria-label="Background opacity"
          title="Background Opacity"
        />
      </div>
      <button
        class="icon-button"
        :class="pinButtonClass"
        type="button"
        :aria-pressed="isPinned"
        :title="pinLabel"
        @click="cyclePin"
      >
        <span aria-hidden="true">{{ pinIcon }}</span>
      </button>
      <button
        class="icon-button"
        type="button"
        :aria-pressed="store.desktopState?.isFullscreen"
        :aria-label="store.desktopState?.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
        @click="store.toggleFullscreen()"
      >
        <span aria-hidden="true">{{ fullscreenIcon }}</span>
      </button>
      <button
        class="icon-button"
        type="button"
        :aria-pressed="store.isSettingsOpen"
        aria-label="Open settings"
        @click="store.setSettingsOpen(!store.isSettingsOpen)"
      >
        <span aria-hidden="true">⚙</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDesktopStore } from "../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../i18n";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const pinLabels: Record<string, string> = {
  off: "Not pinned",
  floating: "Pinned",
  "screen-saver": "Pinned (screen saver)"
};

const pinIcons: Record<string, string> = {
  off: "📍",
  floating: "📌",
  "screen-saver": "🔒"
};

const connectionText = computed(() => store.connectionLabel);
const alwaysOnTop = computed(() => store.settings?.global.alwaysOnTop ?? "off");
const pinLabel = computed(() => pinLabels[alwaysOnTop.value] ?? "Pinned");
const pinIcon = computed(() => pinIcons[alwaysOnTop.value] ?? "📍");
const isPinned = computed(() => alwaysOnTop.value !== "off");
const pinButtonClass = computed(() => ({
  "icon-button--active": alwaysOnTop.value !== "off",
  "icon-button--screen-saver": alwaysOnTop.value === "screen-saver"
}));

const panelOpacityValue = computed({
  get: () => store.panelOpacity,
  set: (value: number) => store.updateGlobalSetting("panelOpacity", value)
});

const fullscreenIcon = computed(() =>
  store.desktopState?.isFullscreen ? "🗗" : "⛶"
);

const transcriptionConfigs = computed(() => store.settings?.transcription.configs ?? []);
const activeTranscriptionId = computed({
  get: () =>
    store.settings?.transcription.activeConfigId ?? transcriptionConfigs.value[0]?.id ?? "",
  set: (value: string) => store.setActiveTranscriptionConfig(value)
});
const transcriptionState = computed(() => store.transcriptionState);
const isTranscribing = computed(() => transcriptionState.value?.status === "running");
const canTranscribe = computed(() => {
  if (!transcriptionConfigs.value.length) {
    return false;
  }
  const state = store.desktopState;
  if (!state || !state.videoUrl) {
    return false;
  }
  return state.activeSource !== "jellyfin";
});


function cyclePin() {
  const order = ["off", "floating", "screen-saver"] as const;
  const current = alwaysOnTop.value;
  const index = order.indexOf(current as any);
  const next = order[(index + 1) % order.length];
  store.updateGlobalSetting("alwaysOnTop", next);
}

async function startTranscription() {
  await store.startTranscription();
}
</script>
