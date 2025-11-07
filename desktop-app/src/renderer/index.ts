import type {
  AppSettings,
  DesktopState,
  PlaybackState,
  SubtitleCue,
  SubtitleTrack
} from "../main/types.js";

const DEFAULT_YTDLP_ARGS = "--skip-download --write-subs --all-subs --cookies-from-browser firefox";

const connectionIndicator = document.getElementById("connection-indicator") as HTMLElement;
const videoTitle = document.getElementById("video-title") as HTMLElement;
const videoUrl = document.getElementById("video-url") as HTMLElement;
const statusBanner = document.getElementById("status-banner") as HTMLElement;
const subtitleList = document.getElementById("subtitle-list") as HTMLElement;
const controlPanel = document.getElementById("control-panel") as HTMLElement;
const primaryTrackSelector = document.getElementById("primary-track-selector") as HTMLSelectElement;
const secondaryTrackSelector = document.getElementById("secondary-track-selector") as HTMLSelectElement;
const playButton = document.getElementById("play-btn") as HTMLButtonElement;
const pauseButton = document.getElementById("pause-btn") as HTMLButtonElement;
const closeBehaviorSelect = document.getElementById("close-behavior") as HTMLSelectElement;
const autostartToggle = document.getElementById("autostart-toggle") as HTMLInputElement;
const subtitleFontInput = document.getElementById("subtitle-font") as HTMLInputElement;
const subtitleFontSizeInput = document.getElementById("subtitle-font-size") as HTMLInputElement;
const subtitleAutoScrollTimeoutInput = document.getElementById("subtitle-auto-scroll-timeout") as HTMLInputElement;
const ytDlpArgsInput = document.getElementById("yt-dlp-args") as HTMLTextAreaElement;
const primaryPriorityList = document.getElementById("primary-priority-list") as HTMLElement;
const secondaryPriorityList = document.getElementById("secondary-priority-list") as HTMLElement;
const primaryPriorityInput = document.getElementById("primary-priority-input") as HTMLInputElement;
const secondaryPriorityInput = document.getElementById("secondary-priority-input") as HTMLInputElement;
const primaryPriorityAddButton = document.getElementById("primary-priority-add") as HTMLButtonElement;
const secondaryPriorityAddButton = document.getElementById("secondary-priority-add") as HTMLButtonElement;
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

type CombinedCue = {
  start: number;
  end: number;
  primaryText: string;
  secondaryText: string | null;
};

type PriorityRole = "primary" | "secondary";

type PriorityEditorElements = {
  list: HTMLElement;
  input: HTMLInputElement;
  addButton: HTMLButtonElement;
};

let currentPlayback: PlaybackState | null = null;
let currentSettings: AppSettings | null = null;
let cueElements: HTMLElement[] = [];
let combinedCues: CombinedCue[] = [];
let activeCueIndex: number | null = null;
let lastTrackSignature = "";
let isSettingsOpen = false;
let autoScrollEnabled = true;
let autoScrollTimer: number | null = null;
let activePriorityDrag: { role: PriorityRole; index: number } | null = null;

const priorityEditors: Record<PriorityRole, PriorityEditorElements> = {
  primary: {
    list: primaryPriorityList,
    input: primaryPriorityInput,
    addButton: primaryPriorityAddButton
  },
  secondary: {
    list: secondaryPriorityList,
    input: secondaryPriorityInput,
    addButton: secondaryPriorityAddButton
  }
};

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
      return { text: "Waiting for extension connection...", modifier: "" };
    case "awaiting-video":
      return { text: "Please open a supported video in your browser", modifier: "" };
    case "loading-subtitles":
      return { text: "Downloading subtitles...", modifier: "" };
    case "ready":
      return { text: "Subtitles loaded", modifier: "status-banner--ready" };
    case "error":
      return { text: state.error ?? "Subtitle loading failed", modifier: "status-banner--error" };
    default:
      return { text: "Unknown status", modifier: "" };
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

function mergeSubtitleCues(primary: SubtitleCue[], secondary: SubtitleCue[]): CombinedCue[] {
  if (!primary.length) {
    return [];
  }

  if (!secondary.length) {
    return primary.map((cue) => ({
      start: cue.start,
      end: cue.end,
      primaryText: cue.text,
      secondaryText: null
    }));
  }

  const merged: CombinedCue[] = [];
  let secondaryIndex = 0;

  for (const primaryCue of primary) {
    while (secondaryIndex < secondary.length && secondary[secondaryIndex].end < primaryCue.start) {
      secondaryIndex += 1;
    }

    let bestMatch: SubtitleCue | null = null;
    let bestOverlap = -1;

    for (let i = secondaryIndex; i < secondary.length; i += 1) {
      const candidate = secondary[i];
      if (candidate.start > primaryCue.end) {
        break;
      }
      const overlap = Math.min(primaryCue.end, candidate.end) - Math.max(primaryCue.start, candidate.start);
      if (overlap >= 0 && overlap >= bestOverlap) {
        bestOverlap = overlap;
        bestMatch = candidate;
      }
    }

    merged.push({
      start: primaryCue.start,
      end: primaryCue.end,
      primaryText: primaryCue.text,
      secondaryText: bestMatch ? bestMatch.text : null
    });
  }

  return merged;
}

function getPriorityValues(role: PriorityRole): string[] {
  if (!currentSettings) {
    return [];
  }
  return role === "primary"
    ? currentSettings.primarySubtitlePriority ?? []
    : currentSettings.secondarySubtitlePriority ?? [];
}

function requestPriorityUpdate(role: PriorityRole, values: string[]) {
  if (role === "primary") {
    updateSettings({ primarySubtitlePriority: values });
  } else {
    updateSettings({ secondarySubtitlePriority: values });
  }
}

function renderPriorityEditor(role: PriorityRole, values: string[]) {
  const container = priorityEditors[role].list;
  container.innerHTML = "";

  if (!values.length) {
    const placeholder = document.createElement("div");
    placeholder.className = "priority-editor__empty";
    placeholder.textContent = "No priorities";
    container.appendChild(placeholder);
    return;
  }

  values.forEach((value, index) => {
    const item = document.createElement("div");
    item.className = "priority-editor__item";
    item.draggable = true;
    item.dataset.index = String(index);

    const textNode = document.createElement("span");
    textNode.className = "priority-editor__item-text";
    textNode.textContent = value;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "priority-editor__item-remove";
    removeButton.setAttribute("aria-label", "Remove priority");
    removeButton.textContent = "×";

    item.appendChild(textNode);
    item.appendChild(removeButton);
    container.appendChild(item);
  });
}

function handlePriorityAdd(role: PriorityRole) {
  const editor = priorityEditors[role];
  const rawValue = editor.input.value.trim();
  if (!rawValue) {
    return;
  }
  const normalized = rawValue.toLowerCase();
  const existing = getPriorityValues(role).map((value) => value.toLowerCase());
  if (existing.includes(normalized)) {
    editor.input.value = "";
    return;
  }
  const nextValues = [...getPriorityValues(role), rawValue];
  requestPriorityUpdate(role, nextValues);
  editor.input.value = "";
}

function handlePriorityRemove(role: PriorityRole, index: number) {
  const values = [...getPriorityValues(role)];
  if (index < 0 || index >= values.length) {
    return;
  }
  values.splice(index, 1);
  requestPriorityUpdate(role, values);
}

function reorderPriorityValue(role: PriorityRole, fromIndex: number, toIndex: number) {
  const values = [...getPriorityValues(role)];
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= values.length ||
    toIndex >= values.length
  ) {
    return;
  }
  const [moved] = values.splice(fromIndex, 1);
  values.splice(toIndex, 0, moved);
  requestPriorityUpdate(role, values);
}

function clearPriorityDragClasses(role: PriorityRole) {
  priorityEditors[role].list
    .querySelectorAll(".priority-editor__item--dragover")
    .forEach((el) => el.classList.remove("priority-editor__item--dragover"));
}

function setupPriorityEditorInteractions(role: PriorityRole) {
  const editor = priorityEditors[role];

  editor.addButton.addEventListener("click", () => {
    handlePriorityAdd(role);
  });

  editor.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handlePriorityAdd(role);
    }
  });

  editor.list.addEventListener("click", (event) => {
    const removeButton = (event.target as HTMLElement).closest(".priority-editor__item-remove");
    if (!removeButton) {
      return;
    }
    const parent = removeButton.closest(".priority-editor__item") as HTMLElement | null;
    if (!parent) {
      return;
    }
    const index = Number(parent.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }
    handlePriorityRemove(role, index);
  });

  editor.list.addEventListener("dragstart", (event) => {
    const target = (event.target as HTMLElement).closest(".priority-editor__item") as HTMLElement | null;
    if (!target) {
      return;
    }
    const index = Number(target.dataset.index);
    if (Number.isNaN(index)) {
      return;
    }
    activePriorityDrag = { role, index };
    event.dataTransfer?.setData("text/plain", String(index));
    event.dataTransfer?.setDragImage(target, 0, 0);
  });

  editor.list.addEventListener("dragover", (event) => {
    if (!activePriorityDrag || activePriorityDrag.role !== role) {
      return;
    }
    const target = (event.target as HTMLElement).closest(".priority-editor__item") as HTMLElement | null;
    if (!target) {
      return;
    }
    event.preventDefault();
    clearPriorityDragClasses(role);
    target.classList.add("priority-editor__item--dragover");
  });

  editor.list.addEventListener("dragleave", () => {
    clearPriorityDragClasses(role);
  });

  editor.list.addEventListener("drop", (event) => {
    if (!activePriorityDrag || activePriorityDrag.role !== role) {
      return;
    }
    const target = (event.target as HTMLElement).closest(".priority-editor__item") as HTMLElement | null;
    if (!target) {
      return;
    }
    event.preventDefault();
    const targetIndex = Number(target.dataset.index);
    if (Number.isNaN(targetIndex)) {
      return;
    }
    const sourceIndex = activePriorityDrag.index;
    clearPriorityDragClasses(role);
    activePriorityDrag = null;
    reorderPriorityValue(role, sourceIndex, targetIndex);
  });

  editor.list.addEventListener("dragend", () => {
    clearPriorityDragClasses(role);
    activePriorityDrag = null;
  });
}

function renderSubtitles(primaryTrack: SubtitleTrack | null, secondaryTrack: SubtitleTrack | null) {
  subtitleList.innerHTML = "";
  cueElements = [];
  combinedCues = [];
  activeCueIndex = null;

  if (!primaryTrack) {
    return;
  }

  combinedCues = mergeSubtitleCues(primaryTrack.cues, secondaryTrack?.cues ?? []);

  combinedCues.forEach((cue, index) => {
    const item = document.createElement("div");
    item.className = "subtitle-item";
    item.dataset.index = String(index);

    const time = document.createElement("span");
    time.className = "subtitle-item__time";
    time.textContent = `${formatTime(cue.start)} - ${formatTime(cue.end)}`;

    const text = document.createElement("div");
    text.className = "subtitle-item__text";

    const primaryLine = document.createElement("div");
    primaryLine.className = "subtitle-item__text-primary";
    primaryLine.innerHTML = escapeHtml(cue.primaryText).replace(/\n/g, "<br />");
    text.appendChild(primaryLine);

    if (cue.secondaryText) {
      const secondaryLine = document.createElement("div");
      secondaryLine.className = "subtitle-item__text-secondary";
      secondaryLine.innerHTML = escapeHtml(cue.secondaryText).replace(/\n/g, "<br />");
      text.appendChild(secondaryLine);
    }

    item.appendChild(time);
    item.appendChild(text);
    subtitleList.appendChild(item);
    cueElements.push(item);
  });
}

function highlightActiveCue(currentTime: number) {
  if (!combinedCues.length) return;

  const newIndex = combinedCues.findIndex((cue) => currentTime >= cue.start && currentTime <= cue.end);
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
    // When auto-scroll is restored, immediately scroll to the currently active subtitle
    if (activeCueIndex !== null && cueElements[activeCueIndex]) {
      cueElements[activeCueIndex].scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, timeoutSeconds * 1000);
}

function renderTrackSelectors(state: DesktopState) {
  if (!state.subtitleTracks.length) {
    controlPanel.style.display = "none";
    primaryTrackSelector.innerHTML = "";
    secondaryTrackSelector.innerHTML = "";
    lastTrackSignature = "";
    return;
  }

  controlPanel.style.display = "flex";
  const signature = state.subtitleTracks.map((track) => `${track.id}:${track.label}`).join("|");
  if (signature !== lastTrackSignature) {
    primaryTrackSelector.innerHTML = "";
    secondaryTrackSelector.innerHTML = "";

    state.subtitleTracks.forEach((track) => {
      const option = document.createElement("option");
      option.value = track.id;
      option.textContent = track.label || track.language;
      primaryTrackSelector.appendChild(option);
    });

    const noneOption = document.createElement("option");
    noneOption.value = "";
    noneOption.textContent = "None";
    secondaryTrackSelector.appendChild(noneOption);

    state.subtitleTracks.forEach((track) => {
      const option = document.createElement("option");
      option.value = track.id;
      option.textContent = track.label || track.language;
      secondaryTrackSelector.appendChild(option);
    });

    lastTrackSignature = signature;
  }

  const fallbackPrimaryId = state.subtitleTracks[0]?.id ?? "";
  const desiredPrimary = state.selectedPrimarySubtitleId ?? fallbackPrimaryId;
  if (desiredPrimary) {
    primaryTrackSelector.value = desiredPrimary;
    if (primaryTrackSelector.value !== desiredPrimary && fallbackPrimaryId) {
      primaryTrackSelector.value = fallbackPrimaryId;
    }
  } else {
    primaryTrackSelector.selectedIndex = -1;
  }

  const secondaryValue = state.selectedSecondarySubtitleId ?? "";
  secondaryTrackSelector.value = secondaryValue;
  if (secondaryTrackSelector.value !== secondaryValue) {
    secondaryTrackSelector.value = "";
  }
}

function renderState(state: DesktopState) {
  connectionIndicator.textContent =
    state.connectionCount > 0 ? `Connected ×${state.connectionCount}` : "Disconnected";

  videoTitle.textContent = state.title ?? "Waiting for video...";
  videoUrl.textContent = formatUrl(state.videoUrl);

  const { text, modifier } = formatStatus(state);
  statusBanner.textContent = text;
  statusBanner.className = `status-banner ${modifier}`;

  renderTrackSelectors(state);

  if (state.primarySubtitles) {
    renderSubtitles(state.primarySubtitles, state.secondarySubtitles);
    if (currentPlayback) {
      highlightActiveCue(currentPlayback.currentTime);
    }
  } else {
    subtitleList.innerHTML = "";
    cueElements = [];
    combinedCues = [];
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
  renderPriorityEditor("primary", settings.primarySubtitlePriority ?? []);
  renderPriorityEditor("secondary", settings.secondarySubtitlePriority ?? []);
  applySubtitleStyles(settings);
}

function updateSettings(partial: Partial<AppSettings>) {
  window.usp.updateSettings(partial).catch((error: unknown) => {
    console.error("[Renderer] Failed to update settings", error);
  });
}

setupPriorityEditorInteractions("primary");
setupPriorityEditorInteractions("secondary");

primaryTrackSelector.addEventListener("change", () => {
  const value = primaryTrackSelector.value || null;
  window.usp.selectSubtitleTrack(value, "primary");
});

secondaryTrackSelector.addEventListener("change", () => {
  const value = secondaryTrackSelector.value || null;
  window.usp.selectSubtitleTrack(value, "secondary");
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
  const cue = combinedCues[index];
  if (cue) {
    window.usp.controlVideo({ type: "seek", time: cue.start });
  }
});

// Listen for user manual scrolling of subtitle list
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
    statusBanner.textContent = `Failed to get initial state: ${error instanceof Error ? error.message : String(error)}`;
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
