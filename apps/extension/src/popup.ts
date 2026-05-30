import { DASHBOARD_PORT, BLACKLIST_STORAGE_KEY } from "./shared/constants";
import {
  APPEARANCE_STORAGE_KEY,
  getStoredAppearanceTheme,
  normalizeAppearanceTheme,
  resolveAppearanceTheme,
  type AppearanceTheme
} from "./shared/appearance";
import { normalizeBlacklistRules, areBlacklistRulesEqual } from "./shared/blacklist-utils";
import { createArrowLeftIcon, createCloseIcon } from "./shared/icons";
import {
  LANGUAGE_STORAGE_KEY,
  applyDocumentI18n,
  formatMessage,
  getLanguagePreference,
  normalizeLanguagePreference,
  setLanguagePreference,
  t,
  type LanguagePreference
} from "./shared/i18n";
import {
  getUrlRuleMatchType,
  normalizeEndpoint,
  normalizeEndpointList,
  parseUrlRulePattern,
  type UrlRuleMatchType
} from "@immersive-subs/contracts";
import type { BlacklistRule, DashboardResponseMessage, DashboardSnapshot, DesktopConnectionSnapshot, MediaInfo } from "./shared/types";

const statusEl = document.getElementById("status-indicator");
const mediaRoot = document.getElementById("media-root");
const serverRoot = document.getElementById("server-root");
const serverSummaryEl = document.getElementById("server-summary");
const settingsPanel = document.getElementById("settings-panel");
const settingsButton = document.getElementById("settings-btn");
const settingsBackButton = document.getElementById("settings-back");
const appearanceOptionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-option]"));
const languageOptionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-language-option]"));
const template = document.getElementById("media-row-template") as HTMLTemplateElement | null;
const blacklistListEl = document.getElementById("blacklist-list");
const blacklistDraftErrorEl = document.getElementById("blacklist-draft-error");

let port: chrome.runtime.Port | null = null;
let blacklistRules: BlacklistRule[] = [];
let serverEndpoints: string[] = [];
type PopupConnection = Pick<DesktopConnectionSnapshot, "endpoint" | "state" | "lastError">;

let connectionStatuses: PopupConnection[] = [];
let serverError = "";
let serverDraftInputEl: HTMLInputElement | null = null;
let serverDraftErrorEl: HTMLElement | null = null;
let serverDraftValue = "";
let blacklistDraftInputEl: HTMLInputElement | null = null;
let blacklistDraftValue = "";
let appearanceTheme: AppearanceTheme = "system";
let lastSnapshot: DashboardSnapshot | null = null;
let staticStatus: { key: string; fallback: string } | null = {
  key: "popupStatusConnecting",
  fallback: "Connecting..."
};

function blacklistRulePlaceholder() {
  return t("blacklistRulePlaceholder", "youtube.com, *.site.com/path/*, =full URL, re:pattern");
}

function serverEndpointPlaceholder() {
  return t("serverEndpointPlaceholder", "ws://192.168.1.10:44501/?token=...");
}

function setStatus(text: string) {
  if (statusEl) {
    statusEl.textContent = text;
  }
}

function setLocalizedStatus(key: string, fallback: string) {
  staticStatus = { key, fallback };
  setStatus(t(key, fallback));
}

function mountStaticIcons() {
  if (settingsBackButton && settingsBackButton.childElementCount === 0) {
    settingsBackButton.appendChild(createArrowLeftIcon({ size: 14, className: "icon icon--arrow-left" }));
  }
}

function systemPrefersDark() {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyAppearance(theme: AppearanceTheme) {
  appearanceTheme = theme;
  document.documentElement.dataset.themeMode = theme;
  document.documentElement.dataset.theme = resolveAppearanceTheme(theme, systemPrefersDark());
  for (const button of appearanceOptionButtons) {
    const selected = button.dataset.themeOption === theme;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  }
}

function saveAppearance(theme: AppearanceTheme) {
  applyAppearance(theme);
  chrome.storage.local.set({ [APPEARANCE_STORAGE_KEY]: theme });
}

function applyLanguagePreference(preference: LanguagePreference) {
  setLanguagePreference(preference);
  applyDocumentI18n(document);
  syncLanguageOptionButtons();
  applyAppearance(appearanceTheme);
  renderServers();
  renderBlacklistRules();
  if (lastSnapshot) {
    handleSnapshot(lastSnapshot);
    return;
  }
  if (staticStatus) {
    setStatus(t(staticStatus.key, staticStatus.fallback));
  }
  renderEmptyState();
}

function saveLanguagePreference(preference: LanguagePreference) {
  applyLanguagePreference(preference);
  chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: preference });
}

function syncLanguageOptionButtons() {
  const preference = getLanguagePreference();
  for (const button of languageOptionButtons) {
    const selected = normalizeLanguagePreference(button.dataset.languageOption) === preference;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-checked", String(selected));
  }
}

function normalizeConnections(input: unknown): PopupConnection[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const endpoint = typeof entry.endpoint === "string" ? entry.endpoint : null;
      if (!endpoint) return null;
      const state = typeof entry.state === "string" ? entry.state : "disconnected";
      const lastError = typeof entry.lastError === "string" ? entry.lastError : null;
      return { endpoint, state, lastError };
    })
    .filter((entry): entry is Pick<DesktopConnectionSnapshot, "endpoint" | "state" | "lastError"> => entry !== null);
}

function getConnectionInfo(endpoint: string): PopupConnection | null {
  return connectionStatuses.find((entry) => entry.endpoint === endpoint) || null;
}

function connectionStatusLabel(state: PopupConnection["state"], hasError: boolean) {
  const base =
    state === "connected"
      ? t("statusConnected", "Connected")
      : state === "connecting"
        ? t("statusConnecting", "Connecting")
        : state === "idle"
          ? t("statusIdle", "Idle")
          : t("statusDisconnected", "Disconnected");
  return hasError ? formatMessage("statusWithError", "{status} · Error", { status: base }) : base;
}

function connectionPillClass(state: PopupConnection["state"], hasError: boolean) {
  if (hasError) return "server-pill--error";
  if (state === "connected") return "server-pill--connected";
  if (state === "connecting") return "server-pill--connecting";
  return "server-pill--disconnected";
}

function setServerError(message = "") {
  serverError = message || "";
  renderServers();
}

function addServerEndpoint(rawValue: string) {
  const normalized = normalizeEndpoint(rawValue);
  if (!normalized) {
    setServerError(t("validationInvalidServerAddress", "Enter a valid ws:// host:port address"));
    return;
  }
  serverError = "";
  serverDraftValue = "";
  if (serverDraftInputEl) {
    serverDraftInputEl.value = "";
  }
  if (serverEndpoints.includes(normalized)) {
    renderServers();
    return;
  }
  renderServers();
  try {
    port?.postMessage({ type: "server-endpoints:add", endpoint: normalized });
  } catch (error) {
    console.error("[USP] Failed to add endpoint", error);
  }
}

function removeServerEndpoint(endpoint: string) {
  try {
    port?.postMessage({ type: "server-endpoints:remove", endpoint });
  } catch (error) {
    console.error("[USP] Failed to remove endpoint", error);
  }
}

function renderServers() {
  if (!serverRoot) return;

  serverDraftValue = serverDraftInputEl?.value ?? serverDraftValue;
  const total = serverEndpoints.length || connectionStatuses.length;
  const connected = connectionStatuses.filter((entry) => entry.state === "connected").length;
  if (serverSummaryEl) {
    serverSummaryEl.textContent = total
      ? formatMessage("settingsServerSummaryConnected", "{connected}/{total} connected", { connected, total })
      : t("settingsServerSummaryEmpty", "Add a server address to start syncing.");
  }

  const editor = document.createElement("div");
  editor.className = "pill-list-editor server-pill-list-editor";

  const list = document.createElement("div");
  list.className = "priority-editor__list pill-list-editor__list server-pill-list";

  serverEndpoints.forEach((endpoint) => {
    const info = getConnectionInfo(endpoint);
    const state = info?.state || "disconnected";
    const hasError = !!info?.lastError;
    const label = connectionStatusLabel(state, hasError);

    const pill = document.createElement("span");
    pill.className = [
      "ui-chip",
      "priority-editor__item",
      "pill-list-editor__item",
      "pill-list-editor__item--removable",
      "server-pill",
      connectionPillClass(state, hasError)
    ].join(" ");
    pill.dataset.endpoint = endpoint;

    const statusDot = document.createElement("span");
    statusDot.className = "server-status-dot";
    statusDot.title = info?.lastError || label;
    statusDot.setAttribute("aria-label", label);

    const endpointEl = document.createElement("span");
    endpointEl.className = "pill-list-editor__display server-endpoint";
    endpointEl.dataset.testid = `server-endpoint-display-${endpoint}`;
    endpointEl.title = `${endpoint} (${label})`;
    endpointEl.textContent = endpoint;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "ui-icon-button ui-icon-button--sm ui-icon-button--ghost pill-list-editor__remove server-remove";
    removeBtn.title = t("actionRemove", "Remove");
    removeBtn.setAttribute("aria-label", t("actionRemove", "Remove"));
    removeBtn.dataset.testid = `server-endpoint-remove-${endpoint}`;
    removeBtn.appendChild(createCloseIcon({ size: 14, className: "icon icon--close" }));
    removeBtn.addEventListener("click", () => removeServerEndpoint(endpoint));

    pill.appendChild(statusDot);
    pill.appendChild(endpointEl);
    pill.appendChild(removeBtn);
    list.appendChild(pill);
  });

  list.appendChild(createServerDraftItem());
  editor.appendChild(list);

  serverDraftErrorEl = document.createElement("div");
  serverDraftErrorEl.className = "settings-field__error server-error";
  serverDraftErrorEl.hidden = !serverError;
  serverDraftErrorEl.textContent = serverError;
  editor.appendChild(serverDraftErrorEl);

  serverRoot.replaceChildren(editor);
}

function createServerDraftItem() {
  const draft = document.createElement("span");
  draft.className = "priority-editor__item priority-editor__draft pill-list-editor__draft server-draft";

  const sizer = document.createElement("span");
  sizer.className = "pill-list-editor__draft-sizer";
  sizer.setAttribute("aria-hidden", "true");
  sizer.textContent = serverDraftValue || serverEndpointPlaceholder() || " ";

  serverDraftInputEl = document.createElement("input");
  serverDraftInputEl.type = "text";
  serverDraftInputEl.className = "ui-input priority-editor__draft-input pill-list-editor__input";
  serverDraftInputEl.dataset.testid = "server-draft-input";
  serverDraftInputEl.placeholder = serverEndpointPlaceholder();
  serverDraftInputEl.value = serverDraftValue;
  serverDraftInputEl.addEventListener("input", () => {
    serverDraftValue = serverDraftInputEl?.value ?? "";
    sizer.textContent = serverDraftValue || serverEndpointPlaceholder() || " ";
    if (serverError) {
      serverError = "";
      if (serverDraftErrorEl) {
        serverDraftErrorEl.hidden = true;
        serverDraftErrorEl.textContent = "";
      }
    }
  });
  serverDraftInputEl.addEventListener("blur", () => {
    if (serverDraftValue.trim()) {
      addServerEndpoint(serverDraftValue);
    }
  });
  serverDraftInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addServerEndpoint(serverDraftValue);
    }
  });

  draft.appendChild(sizer);
  draft.appendChild(serverDraftInputEl);
  return draft;
}

function formatTime(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--:--";
  const sign = value < 0 ? "-" : "";
  // Convert milliseconds to seconds
  let secs = Math.abs(value / 1000);
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  const seconds = Math.floor(secs % 60);
  if (hours > 0) {
    return `${sign}${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${sign}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatVolume(volume: number | null | undefined, muted: boolean | null | undefined) {
  if (muted) return t("mediaMuted", "Muted");
  if (typeof volume !== "number" || volume < 0) return "--";
  return `${Math.round(volume * 100)}%`;
}

function formatRate(rate: number | null | undefined) {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return "--";
  return rate.toFixed(2);
}

function formatResolution(width: number | null | undefined, height: number | null | undefined) {
  if (!width || !height) return null;
  return `${width}×${height}`;
}

function formatRelative(delta: number | null | undefined) {
  if (delta == null) return t("relativeJustNow", "just now");
  const seconds = Math.floor(delta / 1000);
  if (seconds <= 1) return t("relativeJustNow", "just now");
  if (seconds < 60) return formatMessage("relativeSecondsAgo", "{seconds}s ago", { seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatMessage("relativeMinutesAgo", "{minutes}m ago", { minutes });
  const hours = Math.floor(minutes / 60);
  return formatMessage("relativeHoursAgo", "{hours}h ago", { hours });
}

function renderEmptyState() {
  if (!mediaRoot) return;
  const empty = document.createElement("div");
  empty.className = "ui-empty-state empty-state";
  const title = document.createElement("strong");
  title.textContent = t("popupNoMediaTitle", "No media detected");
  const description = document.createElement("p");
  description.textContent = t("popupNoMediaDescription", "Start playing a video to see the live breakdown here.");
  empty.append(title, description);
  mediaRoot.replaceChildren(empty);
}

function fetchBlacklistRules() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get([BLACKLIST_STORAGE_KEY], (result) => {
        if (chrome.runtime?.lastError) {
          console.error("[USP] Failed to load blacklist", chrome.runtime.lastError);
          resolve([]);
          return;
        }
        resolve(result?.[BLACKLIST_STORAGE_KEY] ?? []);
      });
    } catch (error) {
      console.error("[USP] Failed to load blacklist", error);
      resolve([]);
    }
  });
}

function saveBlacklistRules(nextRules: BlacklistRule[], { render = true }: { render?: boolean } = {}) {
  blacklistRules = nextRules;
  if (render) {
    renderBlacklistRules();
  }
  chrome.storage.local.set({ [BLACKLIST_STORAGE_KEY]: nextRules }, () => {
    if (chrome.runtime?.lastError) {
      console.error("[USP] Failed to persist blacklist", chrome.runtime.lastError);
    }
  });
}

function renderBlacklistRules() {
  if (!blacklistListEl) {
    return;
  }
  blacklistListEl.innerHTML = "";

  blacklistRules.forEach((rule) => {
    const item = document.createElement("span");
    item.className = "ui-chip priority-editor__item pill-list-editor__item pill-list-editor__item--removable";
    if (parseUrlRulePattern(rule.value).error) {
      item.classList.add("pill-list-editor__item--error");
    }
    item.dataset.id = rule.id;

    const display = document.createElement("span");
    display.className = "pill-list-editor__display";
    display.dataset.testid = `blacklist-rule-display-${rule.id}`;
    display.title = `${rule.value} (${ruleTypeLabel(rule.value)})`;
    display.textContent = rule.value;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "ui-icon-button ui-icon-button--sm ui-icon-button--ghost pill-list-editor__remove";
    removeButton.title = t("actionRemove", "Remove");
    removeButton.setAttribute("aria-label", t("actionRemove", "Remove"));
    removeButton.dataset.testid = `blacklist-rule-remove-${rule.id}`;
    removeButton.appendChild(createCloseIcon({ size: 14, className: "icon icon--close" }));
    removeButton.addEventListener("click", () => removeBlacklistRule(rule.id));

    item.appendChild(display);
    item.appendChild(removeButton);
    blacklistListEl.appendChild(item);
  });

  blacklistListEl.appendChild(createBlacklistDraftItem());
  updateBlacklistDraftError();
}

function removeBlacklistRule(ruleId: string) {
  const nextRules = blacklistRules.filter((rule) => rule.id !== ruleId);
  saveBlacklistRules(nextRules);
}

function addBlacklistDraft() {
  const value = blacklistDraftValue.trim();
  if (!value || patternErrorMessage(value)) {
    updateBlacklistDraftError();
    return;
  }
  if (blacklistRules.some((rule) => rule.value === value)) {
    blacklistDraftValue = "";
    renderBlacklistRules();
    return;
  }
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const nextRules: BlacklistRule[] = [...blacklistRules, { id, value }];
  blacklistDraftValue = "";
  saveBlacklistRules(nextRules);
}

function createBlacklistDraftItem() {
  const draft = document.createElement("span");
  draft.className = "priority-editor__item priority-editor__draft pill-list-editor__draft";

  const sizer = document.createElement("span");
  sizer.className = "pill-list-editor__draft-sizer";
  sizer.setAttribute("aria-hidden", "true");
  sizer.textContent = blacklistDraftValue || blacklistRulePlaceholder() || " ";

  blacklistDraftInputEl = document.createElement("input");
  blacklistDraftInputEl.type = "text";
  blacklistDraftInputEl.className = "ui-input priority-editor__draft-input pill-list-editor__input";
  blacklistDraftInputEl.dataset.testid = "blacklist-draft-input";
  blacklistDraftInputEl.placeholder = blacklistRulePlaceholder();
  blacklistDraftInputEl.value = blacklistDraftValue;
  blacklistDraftInputEl.addEventListener("input", () => {
    blacklistDraftValue = blacklistDraftInputEl?.value ?? "";
    sizer.textContent = blacklistDraftValue || blacklistRulePlaceholder() || " ";
    updateBlacklistDraftError();
  });
  blacklistDraftInputEl.addEventListener("blur", () => addBlacklistDraft());
  blacklistDraftInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addBlacklistDraft();
    }
  });

  draft.appendChild(sizer);
  draft.appendChild(blacklistDraftInputEl);
  return draft;
}

function updateBlacklistDraftError() {
  if (!blacklistDraftErrorEl) {
    return;
  }
  const message = patternErrorMessage(blacklistDraftValue);
  blacklistDraftErrorEl.textContent = message ?? "";
  blacklistDraftErrorEl.hidden = !message;
}

function patternErrorMessage(pattern: string) {
  const parsed = parseUrlRulePattern(pattern);
  if (parsed.error === "invalid-regex") {
    return t("validationInvalidRegex", "Invalid regular expression");
  }
  return null;
}

function ruleTypeLabel(pattern: string) {
  const labels: Record<UrlRuleMatchType, string> = {
    domain: t("ruleTypeDomain", "Domain"),
    glob: t("ruleTypeGlob", "Glob"),
    exact: t("ruleTypeExact", "Exact"),
    regex: t("ruleTypeRegex", "Regex"),
    contains: t("ruleTypeContains", "Contains")
  };
  return labels[getUrlRuleMatchType(pattern)];
}

function setActivePanel(nextPanel: "settings" | null) {
  const isDrawerOpen = Boolean(nextPanel);
  document.body.classList.toggle("drawer-open", isDrawerOpen);
  document.body.classList.toggle("settings-open", nextPanel === "settings");

  if (settingsPanel) {
    settingsPanel.setAttribute("aria-hidden", String(nextPanel !== "settings"));
  }

  if (!nextPanel) {
    settingsButton?.focus();
    return;
  }

  (settingsBackButton || appearanceOptionButtons.find((button) => button.dataset.themeOption === appearanceTheme) || settingsPanel)?.focus();
}

function renderCards(items: MediaInfo[]) {
  if (!mediaRoot || !template) return;
  mediaRoot.innerHTML = "";
  items.forEach((item) => {
    const blueprint = template.content.firstElementChild;
    if (!blueprint) return;
    const clone = blueprint.cloneNode(true) as HTMLElement;
    const titleEl = clone.querySelector(".media-row__title") as HTMLElement | null;
    const statusEl = clone.querySelector(".media-row__status") as HTMLElement | null;
    const subtitleEl = clone.querySelector(".media-row__subtitle") as HTMLElement | null;
    const metaEl = clone.querySelector(".media-row__meta") as HTMLElement | null;
    const timeEl = clone.querySelector(".media-row__time") as HTMLElement | null;
    const linkEl = clone.querySelector(".media-row__link") as HTMLAnchorElement | null;
    const progressBar = clone.querySelector(".media-row__progress-bar") as HTMLElement | null;

    clone.classList.toggle("playing", !!item.isPlaying);
    clone.classList.toggle("paused", !item.isPlaying);

    if (!titleEl || !statusEl || !subtitleEl || !metaEl || !timeEl || !progressBar) return;

    titleEl.textContent = item.title || item.pageUrl || t("mediaUnknownTitle", "Unknown media");
    statusEl.textContent = item.isPlaying
      ? t("mediaStatusPlaying", "Playing")
      : t("mediaStatusPaused", "Paused");

    let url = null;
    if (item.pageUrl) {
      try {
        url = new URL(item.pageUrl);
      } catch (_) {
        url = null;
      }
    }
    const subtitleBits = [];
    if (item.site && item.site !== "unknown") {
      subtitleBits.push(item.site);
    }
    if (url) {
      subtitleBits.push(url.hostname);
    }
    subtitleEl.textContent = subtitleBits.join(" · ") || "";

    const metaBits = [];
    const resolution = formatResolution(item.videoWidth, item.videoHeight);
    metaBits.push(formatMessage("mediaMetaSpeed", "Speed {rate}x", { rate: formatRate(item.playbackRate) }));
    metaBits.push(formatMessage("mediaMetaVolume", "Volume {volume}", { volume: formatVolume(item.volume, item.muted) }));
    if (resolution) metaBits.push(resolution);
    if (item.pictureInPicture) metaBits.push(t("mediaPictureInPicture", "PiP"));
    metaEl.textContent = metaBits.filter(Boolean).join(" · ");

    const current = formatTime(item.currentTime);
    const total = item.duration ? formatTime(item.duration) : t("mediaTotalLive", "Live");
    timeEl.textContent = `${current} / ${total}`;

    if (typeof item.progress === "number") {
      progressBar.style.width = `${Math.round(item.progress * 100)}%`;
    } else {
      progressBar.style.width = "0%";
    }

    if (item.pageUrl && linkEl) {
      linkEl.href = item.pageUrl;
      linkEl.textContent = t("mediaOpenTab", "Open tab");
    } else if (linkEl) {
      linkEl.remove();
    }

    mediaRoot.appendChild(clone);
  });
}

function syncServersFromPayload(payload: Partial<DashboardSnapshot>) {
  if (payload && Array.isArray(payload.endpoints)) {
    serverEndpoints = normalizeEndpointList(payload.endpoints);
  }
  if (payload && payload.connections) {
    connectionStatuses = normalizeConnections(payload.connections);
  }
  renderServers();
}

function handleSnapshot(payload: DashboardSnapshot) {
  lastSnapshot = payload;
  staticStatus = null;
  syncServersFromPayload(payload);
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) {
    renderEmptyState();
  } else {
    renderCards(items);
  }
  const delta = payload?.generatedAt ? Date.now() - payload.generatedAt : null;
  const playing = items.filter((item) => item.isPlaying).length;
  const totalServers = serverEndpoints.length || connectionStatuses.length;
  const connectedServers = connectionStatuses.filter((entry) => entry.state === "connected").length;
  const parts = [];
  parts.push(totalServers
    ? formatMessage("dashboardServers", "{connected}/{total} servers", { connected: connectedServers, total: totalServers })
    : t("dashboardNoServers", "No servers"));
  parts.push(playing
    ? formatMessage("dashboardPlaying", "{count} playing", { count: playing })
    : formatMessage("dashboardTracked", "{count} tracked", { count: items.length || 0 }));
  parts.push(formatMessage("dashboardUpdated", "updated {relative}", { relative: formatRelative(delta) }));
  setStatus(parts.filter(Boolean).join(" · "));
}

function handleMessage(message: DashboardResponseMessage) {
  if (message?.type === "media-state-snapshot") {
    handleSnapshot(message.payload);
  } else if (message?.type === "server-endpoints") {
    syncServersFromPayload(message.payload);
  }
}

mountStaticIcons();
applyDocumentI18n(document);
syncLanguageOptionButtons();
renderServers();

chrome.storage.local.get([APPEARANCE_STORAGE_KEY, LANGUAGE_STORAGE_KEY], (result) => {
  applyLanguagePreference(normalizeLanguagePreference(result?.[LANGUAGE_STORAGE_KEY]));
  applyAppearance(getStoredAppearanceTheme(result ?? {}));
});

try {
  port = chrome.runtime.connect({ name: DASHBOARD_PORT });
  setLocalizedStatus("popupStatusConnecting", "Connecting...");
  port.onMessage.addListener(handleMessage);
  port.onDisconnect.addListener(() => {
    lastSnapshot = null;
    setLocalizedStatus("popupStatusDisconnected", "Disconnected");
    connectionStatuses = [];
    renderServers();
    renderEmptyState();
  });
  port.postMessage({ type: "server-endpoints:get" });
} catch (err) {
  console.error("[USP] Failed to connect to dashboard port", err);
  lastSnapshot = null;
  setLocalizedStatus("popupStatusUnavailable", "Unavailable");
  renderEmptyState();
}

settingsButton?.addEventListener("click", () => setActivePanel("settings"));
settingsBackButton?.addEventListener("click", () => setActivePanel(null));
for (const button of appearanceOptionButtons) {
  button.addEventListener("click", () => saveAppearance(normalizeAppearanceTheme(button.dataset.themeOption)));
}
for (const button of languageOptionButtons) {
  button.addEventListener("click", () => saveLanguagePreference(normalizeLanguagePreference(button.dataset.languageOption)));
}

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (appearanceTheme === "system") {
    applyAppearance("system");
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("drawer-open")) {
    setActivePanel(null);
  }
});

fetchBlacklistRules().then((raw) => {
  blacklistRules = normalizeBlacklistRules(raw);
  renderBlacklistRules();
});

if (chrome?.storage?.onChanged) {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (Object.prototype.hasOwnProperty.call(changes, APPEARANCE_STORAGE_KEY)) {
      applyAppearance(normalizeAppearanceTheme(changes[APPEARANCE_STORAGE_KEY]?.newValue));
    }
    if (Object.prototype.hasOwnProperty.call(changes, LANGUAGE_STORAGE_KEY)) {
      applyLanguagePreference(normalizeLanguagePreference(changes[LANGUAGE_STORAGE_KEY]?.newValue));
    }
    if (Object.prototype.hasOwnProperty.call(changes, BLACKLIST_STORAGE_KEY)) {
      const storageChange = changes[BLACKLIST_STORAGE_KEY];
      if (!storageChange) {
        return;
      }
      const normalized = normalizeBlacklistRules(storageChange.newValue ?? []);
      if (areBlacklistRulesEqual(normalized, blacklistRules)) {
        return;
      }
      blacklistRules = normalized;
      renderBlacklistRules();
    }
  });
}
