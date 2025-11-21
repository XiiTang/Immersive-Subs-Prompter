<template>
  <header class="window__header">
    <div class="window__title">Immersive Subs Prompter</div>
    <div class="window__status">{{ connectionText }}</div>
  <div class="window__header-actions">
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
        :aria-pressed="false"
        aria-label="Toggle fullscreen on current display"
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

const store = useDesktopStore();

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
  store.desktopState?.status === "ready" ? "🗗" : "⛶"
);

function cyclePin() {
  const order = ["off", "floating", "screen-saver"] as const;
  const current = alwaysOnTop.value;
  const index = order.indexOf(current as any);
  const next = order[(index + 1) % order.length];
  store.updateGlobalSetting("alwaysOnTop", next);
}
</script>
