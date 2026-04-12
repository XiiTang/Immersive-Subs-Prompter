<template>
  <header
    class="window__header"
    ref="headerRef"
    @mousedown="handleMouseDown"
  >
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
        :aria-pressed="store.desktopState?.isFullscreen"
        :aria-label="store.desktopState?.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
        @click="store.toggleFullscreen()"
      >
        <span aria-hidden="true">{{ fullscreenIcon }}</span>
      </button>
      <button
        class="icon-button"
        type="button"
        aria-label="Open settings"
        @click="openSettingsWindow"
      >
        <span aria-hidden="true">⚙</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from "vue";
import { useDesktopStore } from "../stores/desktop";
import { DEFAULT_LANGUAGE, useI18n } from "../i18n";

const store = useDesktopStore();
const language = computed(() => store.settings?.global.language ?? DEFAULT_LANGUAGE);
const { t } = useI18n(language);

const headerRef = useTemplateRef<HTMLElement>("headerRef");

// ===== 窗口拖拽 (使用 Windows 原生 SC_MOVE 命令) =====
// Windows 会完全接管拖拽操作，无需轮询，无尺寸漂移
function handleMouseDown(event: MouseEvent) {
  // 只处理左键点击
  if (event.button !== 0) return;

  // 检查是否点击了可交互元素
  if (isInteractiveElement(event.target as HTMLElement)) return;

  // 通知主进程启动原生窗口拖拽
  // Windows 原生 API 会接管后续操作，不需要监听 mouseup
  window.usp?.startWindowDrag?.();

  event.preventDefault();
}

function isInteractiveElement(element: HTMLElement): boolean {
  const interactiveTags = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'];
  const interactiveClasses = ['icon-button', 'slider', 'transparency-inline', 'window__header-actions'];

  let current: HTMLElement | null = element;
  while (current && current !== headerRef.value) {
    if (interactiveTags.includes(current.tagName)) return true;
    for (const cls of interactiveClasses) {
      if (current.classList.contains(cls)) return true;
    }
    current = current.parentElement;
  }
  return false;
}
// ===== END 窗口拖拽 =====

async function openSettingsWindow() {
  await window.usp?.openSettingsWindow?.();
}

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

function cyclePin() {
  const order = ["off", "floating", "screen-saver"] as const;
  const current = alwaysOnTop.value;
  const index = order.indexOf(current as any);
  const next = order[(index + 1) % order.length];
  store.updateGlobalSetting("alwaysOnTop", next);
}
</script>
