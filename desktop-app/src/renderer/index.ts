import type { AppSettings, DesktopState, PlaybackState, SubtitleCue } from "../main/types.js";

const DEFAULT_YTDLP_ARGS = "--skip-download --write-subs --all-subs --cookies-from-browser firefox";

const connectionIndicator = document.getElementById("connection-indicator") as HTMLElement;
const videoTitle = document.getElementById("video-title") as HTMLElement;
const videoUrl = document.getElementById("video-url") as HTMLElement;
const statusBanner = document.getElementById("status-banner") as HTMLElement;
const subtitleList = document.getElementById("subtitle-list") as HTMLElement;
const controlPanel = document.getElementById("control-panel") as HTMLElement;
const trackSelector = document.getElementById("track-selector") as HTMLSelectElement;
const playButton = document.getElementById("play-btn") as HTMLButtonElement;
const pauseButton = document.getElementById("pause-btn") as HTMLButtonElement;
const closeBehaviorSelect = document.getElementById("close-behavior") as HTMLSelectElement;
const autostartToggle = document.getElementById("autostart-toggle") as HTMLInputElement;
const subtitleFontInput = document.getElementById("subtitle-font") as HTMLInputElement;
const subtitleFontSizeInput = document.getElementById("subtitle-font-size") as HTMLInputElement;
const subtitleAutoScrollTimeoutInput = document.getElementById("subtitle-auto-scroll-timeout") as HTMLInputElement;
const ytDlpArgsInput = document.getElementById("yt-dlp-args") as HTMLTextAreaElement;
const settingsButton = document.getElementById("settings-btn") as HTMLButtonElement;
const settingsBackButton = document.getElementById("settings-back") as HTMLButtonElement;
const settingsPanelElement = document.getElementById("settings-panel") as HTMLElement;
const windowContainer = document.querySelector(".window") as HTMLElement;
const rootElement = document.documentElement;
const computedStyles = window.getComputedStyle(rootElement);
const DEFAULT_SUBTITLE_FONT_FAMILY =
  computedStyles.getPropertyValue("--subtitle-font-family").trim() ||
  '"Inter", "PingFang SC", "Microsoft YaHei", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
const DEFAULT_SUBTITLE_FONT_SIZE =
  parseInt(computedStyles.getPropertyValue("--subtitle-font-size"), 10) || 14;

let currentPlayback: PlaybackState | null = null;
let currentSettings: AppSettings | null = null;
let cueElements: HTMLElement[] = [];
let cues: SubtitleCue[] = [];
let activeCueIndex: number | null = null;
let lastTrackSignature = "";
let isSettingsOpen = false;
let autoScrollEnabled = true;
let autoScrollTimer: number | null = null;

function formatUrl(url: string | null): string {
  if (!url) return "";
  return url.length > 60 ? `${url.slice(0, 57)}...` : url;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatStatus(state: DesktopState): { text: string; modifier: string } {
  switch (state.status) {
    case "idle":
      return { text: "等待插件连接...", modifier: "" };
    case "awaiting-video":
      return { text: "请在浏览器打开支持的网站视频", modifier: "" };
    case "loading-subtitles":
      return { text: "字幕下载中，请稍候...", modifier: "" };
    case "ready":
      return { text: "字幕已加载", modifier: "status-banner--ready" };
    case "error":
      return { text: state.error ?? "字幕加载失败", modifier: "status-banner--error" };
    default:
      return { text: "状态未知", modifier: "" };
  }
}

function formatTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds ?? 0));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function renderSubtitles(subtitleCues: SubtitleCue[]) {
  subtitleList.innerHTML = "";
  cueElements = [];
  cues = subtitleCues;
  activeCueIndex = null;

  subtitleCues.forEach((cue, index) => {
    const item = document.createElement("div");
    item.className = "subtitle-item";
    item.dataset.index = String(index);

    const time = document.createElement("span");
    time.className = "subtitle-item__time";
    time.textContent = `${formatTime(cue.start)} - ${formatTime(cue.end)}`;

    const text = document.createElement("div");
    text.innerHTML = escapeHtml(cue.text).replace(/\n/g, "<br />");

    item.appendChild(time);
    item.appendChild(text);
    subtitleList.appendChild(item);
    cueElements.push(item);
  });
}

function highlightActiveCue(currentTime: number) {
  if (!cues.length) return;

  const newIndex = cues.findIndex((cue) => currentTime >= cue.start && currentTime <= cue.end);
  if (newIndex === -1) {
    if (activeCueIndex !== null && cueElements[activeCueIndex]) {
      cueElements[activeCueIndex].classList.remove("subtitle-item--active");
      activeCueIndex = null;
    }
    return;
  }

  if (newIndex === activeCueIndex) {
    return;
  }

  if (activeCueIndex !== null && cueElements[activeCueIndex]) {
    cueElements[activeCueIndex].classList.remove("subtitle-item--active");
  }

  const element = cueElements[newIndex];
  if (element) {
    element.classList.add("subtitle-item--active");
    if (autoScrollEnabled) {
      element.scrollIntoView({ block: "center", behavior: "smooth" });
    }
    activeCueIndex = newIndex;
  }
}

function resetAutoScrollTimer() {
  if (autoScrollTimer !== null) {
    clearTimeout(autoScrollTimer);
  }
  autoScrollEnabled = false;
  const timeoutSeconds = currentSettings?.subtitleAutoScrollTimeout ?? 3;
  autoScrollTimer = window.setTimeout(() => {
    autoScrollEnabled = true;
    autoScrollTimer = null;
    // 恢复自动滚动时，立即滚动到当前激活的字幕
    if (activeCueIndex !== null && cueElements[activeCueIndex]) {
      cueElements[activeCueIndex].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, timeoutSeconds * 1000);
}

function renderTrackSelector(state: DesktopState) {
  if (!state.subtitleTracks.length) {
    controlPanel.style.display = "none";
    trackSelector.innerHTML = "";
    lastTrackSignature = "";
    return;
  }

  controlPanel.style.display = "flex";
  const signature = state.subtitleTracks.map((track) => track.id).join("|");
  if (signature === lastTrackSignature) {
    if (state.selectedSubtitleId) {
      trackSelector.value = state.selectedSubtitleId;
    } else if (state.subtitleTracks.length) {
      trackSelector.value = state.subtitleTracks[0].id;
    }
    return;
  }

  trackSelector.innerHTML = "";
  state.subtitleTracks.forEach((track) => {
    const option = document.createElement("option");
    option.value = track.id;
    option.textContent = track.label || track.language;
    trackSelector.appendChild(option);
  });

  if (state.selectedSubtitleId) {
    trackSelector.value = state.selectedSubtitleId;
  } else if (state.subtitleTracks.length) {
    trackSelector.value = state.subtitleTracks[0].id;
  }

  lastTrackSignature = signature;
}

function renderState(state: DesktopState) {
  connectionIndicator.textContent =
    state.connectionCount > 0 ? `已连接 ×${state.connectionCount}` : "未连接";

  videoTitle.textContent = state.title ?? "等待视频...";
  videoUrl.textContent = formatUrl(state.videoUrl);

  const { text, modifier } = formatStatus(state);
  statusBanner.textContent = text;
  statusBanner.className = `status-banner ${modifier}`;

  renderTrackSelector(state);

  if (state.subtitles) {
    renderSubtitles(state.subtitles.cues);
    if (currentPlayback) {
      highlightActiveCue(currentPlayback.currentTime);
    }
  } else {
    subtitleList.innerHTML = "";
    cueElements = [];
    cues = [];
    activeCueIndex = null;
  }
}

function setSettingsOpen(nextValue: boolean) {
  if (!windowContainer || !settingsPanelElement || isSettingsOpen === nextValue) {
    return;
  }
  isSettingsOpen = nextValue;
  windowContainer.classList.toggle("window--settings-open", nextValue);
  settingsPanelElement.setAttribute("aria-hidden", String(!nextValue));
  if (nextValue) {
    closeBehaviorSelect.focus();
  } else {
    settingsButton.focus();
  }
}

function applySubtitleStyles(settings: AppSettings) {
  const family = settings.subtitleFontFamily?.trim();
  const fontSize = Number(settings.subtitleFontSize) || DEFAULT_SUBTITLE_FONT_SIZE;
  rootElement.style.setProperty(
    "--subtitle-font-family",
    family && family.length ? family : DEFAULT_SUBTITLE_FONT_FAMILY
  );
  rootElement.style.setProperty("--subtitle-font-size", `${fontSize}px`);
}

function renderSettings(settings: AppSettings) {
  currentSettings = settings;
  closeBehaviorSelect.value = settings.closeBehavior;
  autostartToggle.checked = settings.autoLaunch;
  subtitleFontInput.value = settings.subtitleFontFamily;
  subtitleFontSizeInput.value = String(settings.subtitleFontSize);
  subtitleAutoScrollTimeoutInput.value = String(settings.subtitleAutoScrollTimeout);
  ytDlpArgsInput.placeholder = DEFAULT_YTDLP_ARGS;
  if (ytDlpArgsInput.value !== settings.ytDlpArgs) {
    ytDlpArgsInput.value = settings.ytDlpArgs;
  }
  applySubtitleStyles(settings);
}

function updateSettings(partial: Partial<AppSettings>) {
  window.usp.updateSettings(partial).catch((error: unknown) => {
    console.error("[Renderer] Failed to update settings", error);
  });
}

trackSelector.addEventListener("change", () => {
  const value = trackSelector.value || null;
  window.usp.selectSubtitleTrack(value);
});

settingsButton.addEventListener("click", () => {
  setSettingsOpen(true);
});

settingsBackButton.addEventListener("click", () => {
  setSettingsOpen(false);
});

closeBehaviorSelect.addEventListener("change", () => {
  const nextValue = closeBehaviorSelect.value === "quit" ? "quit" : "tray";
  if (!currentSettings || currentSettings.closeBehavior === nextValue) {
    return;
  }
  updateSettings({ closeBehavior: nextValue });
});

autostartToggle.addEventListener("change", () => {
  const nextValue = Boolean(autostartToggle.checked);
  if (!currentSettings || currentSettings.autoLaunch === nextValue) {
    return;
  }
  updateSettings({ autoLaunch: nextValue });
});

subtitleFontInput.addEventListener("change", () => {
  updateSettings({ subtitleFontFamily: subtitleFontInput.value.trim() });
});

subtitleFontSizeInput.addEventListener("change", () => {
  const nextValue = Number.parseInt(subtitleFontSizeInput.value, 10);
  if (!Number.isFinite(nextValue)) {
    subtitleFontSizeInput.value = String(currentSettings?.subtitleFontSize ?? DEFAULT_SUBTITLE_FONT_SIZE);
    return;
  }
  updateSettings({ subtitleFontSize: nextValue });
});

subtitleAutoScrollTimeoutInput.addEventListener("change", () => {
  const nextValue = Number.parseInt(subtitleAutoScrollTimeoutInput.value, 10);
  if (!Number.isFinite(nextValue) || nextValue < 1) {
    subtitleAutoScrollTimeoutInput.value = String(currentSettings?.subtitleAutoScrollTimeout ?? 3);
    return;
  }
  updateSettings({ subtitleAutoScrollTimeout: nextValue });
});

ytDlpArgsInput.addEventListener("input", () => {
  updateSettings({ ytDlpArgs: ytDlpArgsInput.value });
});

pauseButton.addEventListener("click", () => {
  window.usp.controlVideo({ type: "pause" });
});

playButton.addEventListener("click", () => {
  window.usp.controlVideo({ type: "play" });
});

subtitleList.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest(".subtitle-item") as HTMLElement | null;
  if (!target) return;
  const index = Number(target.dataset.index);
  if (Number.isNaN(index)) return;
  const cue = cues[index];
  if (cue) {
    window.usp.controlVideo({ type: "seek", time: cue.start });
  }
});

// 监听用户手动滚动字幕列表
subtitleList.addEventListener("wheel", () => {
  resetAutoScrollTimer();
}, { passive: true });

subtitleList.addEventListener("touchmove", () => {
  resetAutoScrollTimer();
}, { passive: true });

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && isSettingsOpen) {
    setSettingsOpen(false);
  }
});

async function bootstrap() {
  try {
    const initialState = await window.usp.getInitialState();
    renderState(initialState);
  } catch (error) {
    console.error("[Renderer] Failed to get initial state:", error);
    statusBanner.textContent = `无法获取初始状态: ${error instanceof Error ? error.message : String(error)}`;
    statusBanner.className = "status-banner status-banner--error";
  }

  try {
    const initialSettings = await window.usp.getSettings();
    renderSettings(initialSettings);
  } catch (error) {
    console.error("[Renderer] Failed to load settings:", error);
  }

  window.usp.onStateChange((nextState) => {
    renderState(nextState);
  });

  window.usp.onPlayback((payload) => {
    currentPlayback = payload;
    highlightActiveCue(payload.currentTime);
  });

  window.usp.onSettingsChange((settings) => {
    renderSettings(settings);
  });
}

bootstrap();
