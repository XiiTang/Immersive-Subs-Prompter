import type { DesktopState, PlaybackState, SubtitleCue, YtDlpConfig } from "../main/types.js";

const connectionIndicator = document.getElementById("connection-indicator") as HTMLElement;
const videoTitle = document.getElementById("video-title") as HTMLElement;
const videoUrl = document.getElementById("video-url") as HTMLElement;
const subtitleLanguage = document.getElementById("subtitle-language") as HTMLElement;
const statusBanner = document.getElementById("status-banner") as HTMLElement;
const subtitleList = document.getElementById("subtitle-list") as HTMLElement;
const controlPanel = document.getElementById("control-panel") as HTMLElement;
const trackSelector = document.getElementById("track-selector") as HTMLSelectElement;
const playButton = document.getElementById("play-btn") as HTMLButtonElement;
const pauseButton = document.getElementById("pause-btn") as HTMLButtonElement;
const ytDlpForm = document.getElementById("yt-dlp-form") as HTMLFormElement;
const ytDlpCookiesInput = document.getElementById("yt-dlp-cookies") as HTMLInputElement;
const ytDlpLanguagesInput = document.getElementById("yt-dlp-languages") as HTMLInputElement;
const ytDlpStatus = document.getElementById("yt-dlp-status") as HTMLElement;

let currentState: DesktopState | null = null;
let currentPlayback: PlaybackState | null = null;
let cueElements: HTMLElement[] = [];
let cues: SubtitleCue[] = [];
let activeCueIndex: number | null = null;
let lastTrackSignature = "";
let currentYtDlpConfig: YtDlpConfig | null = null;

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
    element.scrollIntoView({ block: "center", behavior: "smooth" });
    activeCueIndex = newIndex;
  }
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
  subtitleLanguage.textContent = state.subtitles
    ? `当前字幕：${state.subtitles.label}`
    : "";

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

trackSelector.addEventListener("change", () => {
  const value = trackSelector.value || null;
  window.usp.selectSubtitleTrack(value);
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

function parseLanguageInput(value: string): string[] {
  return value
    .split(/[,，\s]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function renderYtDlpConfig(config: YtDlpConfig) {
  currentYtDlpConfig = config;
  ytDlpCookiesInput.value = config.cookiesFile ?? "";
  ytDlpLanguagesInput.value = config.subtitleLanguages.join(", ");
}

function setSettingsStatus(message: string, isError = false) {
  if (!ytDlpStatus) return;
  ytDlpStatus.textContent = message;
  ytDlpStatus.classList.toggle("settings__status--error", isError && !!message);
}

async function loadYtDlpConfig() {
  try {
    const config = await window.usp.getYtDlpConfig();
    renderYtDlpConfig(config);
    setSettingsStatus("");
  } catch (error) {
    console.error("[Renderer] Failed to load yt-dlp config:", error);
    setSettingsStatus(
      `无法加载配置：${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
}

ytDlpForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload: Partial<YtDlpConfig> = {
    cookiesFile: ytDlpCookiesInput.value.trim(),
    subtitleLanguages: parseLanguageInput(ytDlpLanguagesInput.value)
  };

  try {
    setSettingsStatus("保存中...");
    const updated = await window.usp.updateYtDlpConfig(payload);
    renderYtDlpConfig(updated);
    setSettingsStatus("配置已保存");
  } catch (error) {
    console.error("[Renderer] Failed to save yt-dlp config:", error);
    setSettingsStatus(
      `保存失败：${error instanceof Error ? error.message : String(error)}`,
      true
    );
  }
});

async function bootstrap() {
  try {
    const initialState = await window.usp.getInitialState();
    currentState = initialState;
    renderState(initialState);
  } catch (error) {
    console.error("[Renderer] Failed to get initial state:", error);
    statusBanner.textContent = `无法获取初始状态: ${error instanceof Error ? error.message : String(error)}`;
    statusBanner.className = "status-banner status-banner--error";
  }

  window.usp.onStateChange((nextState) => {
    currentState = nextState;
    renderState(nextState);
  });

  window.usp.onPlayback((payload) => {
    currentPlayback = payload;
    highlightActiveCue(payload.currentTime);
  });

  await loadYtDlpConfig();
}

bootstrap();
