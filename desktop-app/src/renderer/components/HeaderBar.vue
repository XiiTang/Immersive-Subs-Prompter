<template>
  <header class="window__header">
    <div class="window__title">Immersive Subs Prompter</div>
    <div class="window__status">{{ connectionText }}</div>
    <div class="window__header-actions">
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
      <div class="transparency-control" ref="transparencyControl">
        <button
          class="icon-button"
          type="button"
          aria-label="Adjust panel opacity"
          :aria-expanded="showTransparency"
          @click.stop="showTransparency = !showTransparency"
        >
          <span aria-hidden="true">🌓</span>
        </button>
        <div
          class="transparency-popover"
          :class="{ 'is-open': showTransparency }"
          aria-hidden="true"
          ref="transparencyPopover"
        >
          <div class="transparency-popover__label">
            <span>Background Opacity</span>
            <span class="transparency-popover__value">{{ panelOpacity }}%</span>
          </div>
          <input
            class="slider"
            type="range"
            min="0"
            max="100"
            step="1"
            v-model.number="panelOpacityValue"
            aria-label="Background opacity"
          />
        </div>
      </div>
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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
const panelOpacity = computed(() => store.panelOpacity);

const fullscreenIcon = computed(() =>
  store.desktopState?.status === "ready" ? "🗗" : "⛶"
);

const transparencyPopover = ref<HTMLElement | null>(null);
const transparencyControl = ref<HTMLElement | null>(null);
const showTransparency = ref(false);

function cyclePin() {
  const order = ["off", "floating", "screen-saver"] as const;
  const current = alwaysOnTop.value;
  const index = order.indexOf(current as any);
  const next = order[(index + 1) % order.length];
  store.updateGlobalSetting("alwaysOnTop", next);
}

function handleDocumentClick(event: MouseEvent) {
  if (!showTransparency.value) {
    return;
  }
  const popover = transparencyPopover.value;
  const control = transparencyControl.value;
  if (
    popover &&
    control &&
    event.target instanceof Node &&
    (popover.contains(event.target) || control.contains(event.target))
  ) {
    return;
  }
  showTransparency.value = false;
}

onMounted(() => {
  document.addEventListener("click", handleDocumentClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("click", handleDocumentClick);
});
</script>
