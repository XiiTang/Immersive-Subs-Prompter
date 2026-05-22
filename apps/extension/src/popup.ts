import { DASHBOARD_PORT, BLACKLIST_STORAGE_KEY } from "./shared/constants";
import {
  APPEARANCE_STORAGE_KEY,
  getStoredAppearanceTheme,
  normalizeAppearanceTheme,
  resolveAppearanceTheme,
  type AppearanceTheme
} from "./shared/appearance";
import { normalizeEndpoint, normalizeEndpointList } from "./shared/endpoint-utils";
import { normalizeBlacklistRules, areBlacklistRulesEqual } from "./shared/blacklist-utils";
import { createAddIcon, createDeleteIcon } from "./shared/icons";
import type { BlacklistRule, DashboardResponseMessage, DashboardSnapshot, DesktopConnectionSnapshot, MediaInfo } from "./shared/types";

const statusEl = document.getElementById("status-indicator");
const mediaRoot = document.getElementById("media-root");
const serverRoot = document.getElementById("server-root");
const connectionsPanel = document.getElementById("connections-panel");
const connectionsButton = document.getElementById("connections-btn");
const connectionsBackButton = document.getElementById("connections-back");
const appearancePanel = document.getElementById("appearance-panel");
const appearanceButton = document.getElementById("appearance-btn");
const appearanceBackButton = document.getElementById("appearance-back");
const appearanceOptionButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-theme-option]"));
const template = document.getElementById("media-row-template") as HTMLTemplateElement | null;
const blacklistPanel = document.getElementById("blacklist-panel");
const blacklistButton = document.getElementById("blacklist-btn");
const blacklistBackButton = document.getElementById("blacklist-back");
const blacklistListEl = document.getElementById("blacklist-list");
const blacklistEmptyStateEl = document.getElementById("blacklist-empty-state");
const addBlacklistRuleButton = document.getElementById("add-blacklist-rule");

let port: chrome.runtime.Port | null = null;
let blacklistRules: BlacklistRule[] = [];
let serverEndpoints: string[] = [];
type PopupConnection = Pick<DesktopConnectionSnapshot, "endpoint" | "state" | "lastError">;

let connectionStatuses: PopupConnection[] = [];
let serverError = "";
let serverInputEl: HTMLInputElement | null = null;
let activePanel: "blacklist" | "connections" | "appearance" | null = null;
let appearanceTheme: AppearanceTheme = "system";

function setStatus(text: string) {
  if (statusEl) {
    statusEl.textContent = text;
  }
}

export function appearanceLabel(theme: AppearanceTheme): string {
  if (theme === "light") return "Light";
  if (theme === "dark") return "Dark";
  return "System";
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
      ? "Connected"
      : state === "connecting"
        ? "Connecting"
        : state === "idle"
          ? "Idle"
          : "Disconnected";
  return hasError ? `${base} · Error` : base;
}

function connectionStatusClass(state: PopupConnection["state"], hasError: boolean) {
  let cls = "server-status";
  if (state === "connected") {
    cls += " server-status--connected";
  } else if (state === "connecting") {
    cls += " server-status--connecting";
  } else if (hasError) {
    cls += " server-status--error";
  }
  return cls;
}

function setServerError(message = "") {
  serverError = message || "";
  renderServers();
}

function addServerEndpoint(rawValue: string) {
  const normalized = normalizeEndpoint(rawValue);
  if (!normalized) {
    setServerError("Enter a valid ws:// or wss:// address");
    return;
  }
  setServerError("");
  if (serverInputEl) {
    serverInputEl.value = "";
  }
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

  const previousValue = serverInputEl?.value ?? "";
  const card = document.createElement("div");
  card.className = "popup-section";

  const header = document.createElement("div");
  header.className = "popup-section__header";
  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "popup-section__title";
  title.textContent = "Desktop Apps";
  const subtitle = document.createElement("div");
  subtitle.className = "popup-section__subtitle";
  const total = serverEndpoints.length || connectionStatuses.length;
  const connected = connectionStatuses.filter((entry) => entry.state === "connected").length;
  subtitle.textContent = total ? `${connected}/${total} connected` : "Add a server address to start syncing.";
  titleWrap.appendChild(title);
  titleWrap.appendChild(subtitle);
  header.appendChild(titleWrap);
  card.appendChild(header);

  const addRow = document.createElement("div");
  addRow.className = "server-add";
  serverInputEl = document.createElement("input");
  serverInputEl.type = "text";
  serverInputEl.className = "server-input";
  serverInputEl.placeholder = "ws://192.168.1.10:44501/?token=...";
  serverInputEl.autocomplete = "off";
  serverInputEl.value = previousValue;
  serverInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      addServerEndpoint(serverInputEl?.value ?? "");
    }
  });
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.className = "icon-btn";
  addBtn.title = "Add";
  addBtn.setAttribute("aria-label", "Add");
  addBtn.appendChild(createAddIcon({ size: 16, className: "icon icon--add" }));
      addBtn.addEventListener("click", () => addServerEndpoint(serverInputEl?.value ?? ""));
  addRow.appendChild(serverInputEl);
  addRow.appendChild(addBtn);
  card.appendChild(addRow);

  if (serverError) {
    const errorEl = document.createElement("div");
    errorEl.className = "server-error";
    errorEl.textContent = serverError;
    card.appendChild(errorEl);
  }

  const list = document.createElement("div");
  list.className = "server-list";
  if (!serverEndpoints.length) {
    const empty = document.createElement("div");
    empty.className = "server-empty";
    empty.textContent = "No servers configured.";
    list.appendChild(empty);
  } else {
    serverEndpoints.forEach((endpoint) => {
      const row = document.createElement("div");
      row.className = "server-row";

      const endpointEl = document.createElement("div");
      endpointEl.className = "server-endpoint";
      endpointEl.textContent = endpoint;

      const info = getConnectionInfo(endpoint);
      const state = info?.state || "disconnected";
      const statusEl = document.createElement("div");
      statusEl.className = connectionStatusClass(state, !!info?.lastError);
      statusEl.title = info?.lastError || "";
      statusEl.innerHTML = `<span class="server-status__dot"></span><span>${connectionStatusLabel(
        state,
        !!info?.lastError
      )}</span>`;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "server-remove icon-btn";
      removeBtn.title = "Remove";
      removeBtn.setAttribute("aria-label", "Remove");
      removeBtn.appendChild(createDeleteIcon({ size: 16, className: "icon icon--delete" }));
      removeBtn.addEventListener("click", () => removeServerEndpoint(endpoint));

      row.appendChild(endpointEl);
      row.appendChild(statusEl);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }
  card.appendChild(list);
  serverRoot.replaceChildren(card);
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
  if (muted) return "Muted";
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
  if (delta == null) return "just now";
  const seconds = Math.floor(delta / 1000);
  if (seconds <= 1) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function renderEmptyState() {
  if (!mediaRoot) return;
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.innerHTML = "<strong>No media detected</strong><p>Start playing a video to see the live breakdown here.</p>";
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

function isRegexValid(pattern: string) {
  if (!pattern) {
    return true;
  }
  try {
    new RegExp(pattern);
    return true;
  } catch (error) {
    return false;
  }
}

function renderBlacklistRules() {
  if (!blacklistListEl || !blacklistEmptyStateEl) {
    return;
  }
  blacklistListEl.innerHTML = "";
  if (!blacklistRules.length) {
    blacklistEmptyStateEl.hidden = false;
    blacklistListEl.hidden = true;
    return;
  }
  blacklistEmptyStateEl.hidden = true;
  blacklistListEl.hidden = false;

  blacklistRules.forEach((rule) => {
    const item = document.createElement("div");
    item.className = "blacklist-item";
    item.dataset.id = rule.id;

    const row = document.createElement("div");
    row.className = "blacklist-item__row";

    const select = document.createElement("select");
    select.className = "blacklist-item__select";
    [
      { value: "contains", label: "Contains" },
      { value: "exact", label: "Exact Match" },
      { value: "regex", label: "Regex" }
    ].forEach((optionMeta) => {
      const option = document.createElement("option");
      option.value = optionMeta.value;
      option.textContent = optionMeta.label;
      select.appendChild(option);
    });
    select.value = rule.mode;
    const input = document.createElement("input");
    input.className = "blacklist-item__input";
    input.type = "text";
    input.placeholder = "Enter URL or keywords to match";
    input.value = rule.value;
    const error = document.createElement("div");
    error.className = "blacklist-item__error";
    const updateErrorMessage = () => {
      const currentMode = select.value;
      const currentValue = input.value;
      error.textContent = currentMode === "regex" && !isRegexValid(currentValue) ? "Invalid regex" : "";
    };
    select.addEventListener("change", () => {
      updateBlacklistRule(rule.id, { mode: select.value as BlacklistRule["mode"] });
      updateErrorMessage();
    });
    input.addEventListener("input", () => {
      updateBlacklistRule(rule.id, { value: input.value });
      updateErrorMessage();
    });

    row.appendChild(select);
    row.appendChild(input);

    const footer = document.createElement("div");
    footer.className = "blacklist-item__footer";
    updateErrorMessage();

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "blacklist-item__remove icon-btn";
    removeButton.title = "Remove";
    removeButton.setAttribute("aria-label", "Remove");
    removeButton.appendChild(createDeleteIcon({ size: 16, className: "icon icon--delete" }));
    removeButton.addEventListener("click", () => removeBlacklistRule(rule.id));

    footer.appendChild(error);
    footer.appendChild(removeButton);

    item.appendChild(row);
    item.appendChild(footer);
    blacklistListEl.appendChild(item);
  });
}

function updateBlacklistRule(ruleId: string, partial: Partial<BlacklistRule>) {
  const index = blacklistRules.findIndex((rule) => rule.id === ruleId);
  if (index === -1) {
    return;
  }
  const current = blacklistRules[index];
  if (!current) {
    return;
  }
  const next = { ...current, ...partial };
  if (current.mode === next.mode && current.value === next.value) {
    return;
  }
  const nextRules = [...blacklistRules];
  nextRules[index] = next;
  saveBlacklistRules(nextRules, { render: false });
}

function removeBlacklistRule(ruleId: string) {
  const nextRules = blacklistRules.filter((rule) => rule.id !== ruleId);
  saveBlacklistRules(nextRules);
}

function addBlacklistRule() {
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const nextRules: BlacklistRule[] = [...blacklistRules, { id, mode: "contains", value: "" }];
  saveBlacklistRules(nextRules);
}

function setActivePanel(nextPanel: "blacklist" | "connections" | "appearance" | null) {
  const prevPanel = activePanel;
  activePanel = nextPanel;
  const isDrawerOpen = Boolean(nextPanel);
  document.body.classList.toggle("drawer-open", isDrawerOpen);
  document.body.classList.toggle("blacklist-open", nextPanel === "blacklist");
  document.body.classList.toggle("connections-open", nextPanel === "connections");
  document.body.classList.toggle("appearance-open", nextPanel === "appearance");

  if (blacklistPanel) {
    blacklistPanel.setAttribute("aria-hidden", String(nextPanel !== "blacklist"));
  }
  if (connectionsPanel) {
    connectionsPanel.setAttribute("aria-hidden", String(nextPanel !== "connections"));
  }
  if (appearancePanel) {
    appearancePanel.setAttribute("aria-hidden", String(nextPanel !== "appearance"));
  }

  if (!nextPanel) {
    if (prevPanel === "blacklist") {
      blacklistButton?.focus();
    } else if (prevPanel === "connections") {
      connectionsButton?.focus();
    } else if (prevPanel === "appearance") {
      appearanceButton?.focus();
    }
    return;
  }

  if (nextPanel === "blacklist") {
    (addBlacklistRuleButton || blacklistPanel)?.focus();
  } else if (nextPanel === "connections") {
    (serverInputEl || connectionsPanel)?.focus();
  } else if (nextPanel === "appearance") {
    (appearanceOptionButtons.find((button) => button.dataset.themeOption === appearanceTheme) || appearancePanel)?.focus();
  }
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

    titleEl.textContent = item.title || item.pageUrl || "Unknown media";
    statusEl.textContent = item.isPlaying ? "Playing" : "Paused";

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
    metaBits.push(`Speed ${formatRate(item.playbackRate)}x`);
    metaBits.push(`Volume ${formatVolume(item.volume, item.muted)}`);
    if (resolution) metaBits.push(resolution);
    if (item.pictureInPicture) metaBits.push("PiP");
    metaEl.textContent = metaBits.filter(Boolean).join(" · ");

    const current = formatTime(item.currentTime);
    const total = item.duration ? formatTime(item.duration) : "Live";
    timeEl.textContent = `${current} / ${total}`;

    if (typeof item.progress === "number") {
      progressBar.style.width = `${Math.round(item.progress * 100)}%`;
    } else {
      progressBar.style.width = "0%";
    }

    if (item.pageUrl && linkEl) {
      linkEl.href = item.pageUrl;
      linkEl.textContent = "Open tab";
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
  parts.push(totalServers ? `${connectedServers}/${totalServers} servers` : "No servers");
  parts.push(playing ? `${playing} playing` : `${items.length || 0} tracked`);
  parts.push(`updated ${formatRelative(delta)}`);
  setStatus(parts.filter(Boolean).join(" · "));
}

function handleMessage(message: DashboardResponseMessage) {
  if (message?.type === "media-state-snapshot") {
    handleSnapshot(message.payload);
  } else if (message?.type === "server-endpoints") {
    syncServersFromPayload(message.payload);
  }
}

renderServers();

chrome.storage.local.get([APPEARANCE_STORAGE_KEY], (result) => {
  applyAppearance(getStoredAppearanceTheme(result ?? {}));
});

try {
  port = chrome.runtime.connect({ name: DASHBOARD_PORT });
  setStatus("Connecting…");
  port.onMessage.addListener(handleMessage);
  port.onDisconnect.addListener(() => {
    setStatus("Disconnected");
    connectionStatuses = [];
    renderServers();
    renderEmptyState();
  });
  port.postMessage({ type: "server-endpoints:get" });
} catch (err) {
  console.error("[USP] Failed to connect to dashboard port", err);
  setStatus("Unavailable");
  renderEmptyState();
}

blacklistButton?.addEventListener("click", () => setActivePanel("blacklist"));
blacklistBackButton?.addEventListener("click", () => setActivePanel(null));
connectionsButton?.addEventListener("click", () => setActivePanel("connections"));
connectionsBackButton?.addEventListener("click", () => setActivePanel(null));
appearanceButton?.addEventListener("click", () => setActivePanel("appearance"));
appearanceBackButton?.addEventListener("click", () => setActivePanel(null));
addBlacklistRuleButton?.addEventListener("click", () => addBlacklistRule());
for (const button of appearanceOptionButtons) {
  button.addEventListener("click", () => saveAppearance(normalizeAppearanceTheme(button.dataset.themeOption)));
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
