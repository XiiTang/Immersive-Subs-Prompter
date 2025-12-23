// src/shared/constants.js
var BLACKLIST_STORAGE_KEY = "uspBlacklistRules";
var DASHBOARD_PORT = "usp-dashboard";

// src/shared/endpoint-utils.js
function normalizeEndpoint(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^wss?:\/\//i.test(trimmed)) {
    if (/^[a-z0-9.-]+(:\d+)?$/i.test(trimmed)) {
      return `ws://${trimmed}`;
    }
    return null;
  }
  return trimmed;
}
function normalizeEndpointList(list) {
  const endpoints = [];
  const seen = /* @__PURE__ */ new Set();
  (Array.isArray(list) ? list : []).forEach((entry) => {
    const normalized = normalizeEndpoint(entry);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    endpoints.push(normalized);
  });
  return endpoints;
}

// src/shared/blacklist-utils.js
var BLACKLIST_MODES = Object.freeze(["contains", "exact", "regex"]);
var BLACKLIST_MODE_SET = new Set(BLACKLIST_MODES);
function normalizeBlacklistRules(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const id = typeof entry.id === "string" && entry.id.length ? entry.id : `rule-${Date.now()}-${index}`;
    const mode = typeof entry.mode === "string" && BLACKLIST_MODE_SET.has(entry.mode) ? entry.mode : "contains";
    const value = typeof entry.value === "string" ? entry.value.trim() : "";
    return { id, mode, value };
  }).filter(Boolean);
}
function areBlacklistRulesEqual(a, b) {
  const left = Array.isArray(a) ? a : [];
  const right = Array.isArray(b) ? b : [];
  if (left.length !== right.length) {
    return false;
  }
  return left.every((rule, index) => {
    const other = right[index];
    return rule?.id === other?.id && rule?.mode === other?.mode && rule?.value === other?.value;
  });
}

// src/popup.js
var statusEl = document.getElementById("status-indicator");
var mediaRoot = document.getElementById("media-root");
var serverRoot = document.getElementById("server-root");
var connectionsPanel = document.getElementById("connections-panel");
var connectionsButton = document.getElementById("connections-btn");
var connectionsBackButton = document.getElementById("connections-back");
var template = document.getElementById("media-card-template");
var blacklistPanel = document.getElementById("blacklist-panel");
var blacklistButton = document.getElementById("blacklist-btn");
var blacklistBackButton = document.getElementById("blacklist-back");
var blacklistListEl = document.getElementById("blacklist-list");
var blacklistEmptyStateEl = document.getElementById("blacklist-empty-state");
var addBlacklistRuleButton = document.getElementById("add-blacklist-rule");
var port;
var blacklistRules = [];
var serverEndpoints = [];
var connectionStatuses = [];
var serverError = "";
var serverInputEl = null;
var activePanel = null;
function setStatus(text) {
  if (statusEl) {
    statusEl.textContent = text;
  }
}
function normalizeConnections(input) {
  if (!Array.isArray(input)) return [];
  return input.map((entry) => {
    if (!entry || typeof entry !== "object") return null;
    const endpoint = typeof entry.endpoint === "string" ? entry.endpoint : null;
    if (!endpoint) return null;
    const state = typeof entry.state === "string" ? entry.state : "disconnected";
    const lastError = typeof entry.lastError === "string" ? entry.lastError : null;
    return { endpoint, state, lastError };
  }).filter(Boolean);
}
function getConnectionInfo(endpoint) {
  return connectionStatuses.find((entry) => entry.endpoint === endpoint) || null;
}
function connectionStatusLabel(state, hasError) {
  const base = state === "connected" ? "Connected" : state === "connecting" ? "Connecting" : state === "idle" ? "Idle" : "Disconnected";
  return hasError ? `${base} \xB7 Error` : base;
}
function connectionStatusClass(state, hasError) {
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
function addServerEndpoint(rawValue) {
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
function removeServerEndpoint(endpoint) {
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
  card.className = "server-card";
  const header = document.createElement("div");
  header.className = "server-card__header";
  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "server-card__title";
  title.textContent = "Desktop Apps";
  const subtitle = document.createElement("div");
  subtitle.className = "server-card__subtitle";
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
  serverInputEl.placeholder = "ws://192.168.1.10:44501";
  serverInputEl.autocomplete = "off";
  serverInputEl.value = previousValue;
  serverInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      addServerEndpoint(serverInputEl.value);
    }
  });
  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", () => addServerEndpoint(serverInputEl.value));
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
      const statusEl2 = document.createElement("div");
      statusEl2.className = connectionStatusClass(state, !!info?.lastError);
      statusEl2.title = info?.lastError || "";
      statusEl2.innerHTML = `<span class="server-status__dot"></span><span>${connectionStatusLabel(
        state,
        !!info?.lastError
      )}</span>`;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "server-remove";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => removeServerEndpoint(endpoint));
      row.appendChild(endpointEl);
      row.appendChild(statusEl2);
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  }
  card.appendChild(list);
  serverRoot.replaceChildren(card);
}
function formatTime(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--:--";
  const sign = value < 0 ? "-" : "";
  let secs = Math.abs(value / 1e3);
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor(secs % 3600 / 60);
  const seconds = Math.floor(secs % 60);
  if (hours > 0) {
    return `${sign}${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${sign}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function formatVolume(volume, muted) {
  if (muted) return "Muted";
  if (typeof volume !== "number" || volume < 0) return "--";
  return `${Math.round(volume * 100)}%`;
}
function formatRate(rate) {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return "--";
  return rate.toFixed(2);
}
function formatResolution(width, height) {
  if (!width || !height) return null;
  return `${width}\xD7${height}`;
}
function formatRelative(delta) {
  if (delta == null) return "just now";
  const seconds = Math.floor(delta / 1e3);
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
function saveBlacklistRules(nextRules, { render = true } = {}) {
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
function isRegexValid(pattern) {
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
      updateBlacklistRule(rule.id, { mode: select.value });
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
    removeButton.className = "blacklist-item__remove";
    removeButton.textContent = "Remove";
    removeButton.addEventListener("click", () => removeBlacklistRule(rule.id));
    footer.appendChild(error);
    footer.appendChild(removeButton);
    item.appendChild(row);
    item.appendChild(footer);
    blacklistListEl.appendChild(item);
  });
}
function updateBlacklistRule(ruleId, partial) {
  const index = blacklistRules.findIndex((rule) => rule.id === ruleId);
  if (index === -1) {
    return;
  }
  const current = blacklistRules[index];
  const next = { ...current, ...partial };
  if (current.mode === next.mode && current.value === next.value) {
    return;
  }
  const nextRules = [...blacklistRules];
  nextRules[index] = next;
  saveBlacklistRules(nextRules, { render: false });
}
function removeBlacklistRule(ruleId) {
  const nextRules = blacklistRules.filter((rule) => rule.id !== ruleId);
  saveBlacklistRules(nextRules);
}
function addBlacklistRule() {
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const nextRules = [...blacklistRules, { id, mode: "contains", value: "" }];
  saveBlacklistRules(nextRules);
}
function setActivePanel(nextPanel) {
  const prevPanel = activePanel;
  activePanel = nextPanel;
  const isDrawerOpen = Boolean(nextPanel);
  document.body.classList.toggle("drawer-open", isDrawerOpen);
  document.body.classList.toggle("blacklist-open", nextPanel === "blacklist");
  document.body.classList.toggle("connections-open", nextPanel === "connections");
  if (blacklistPanel) {
    blacklistPanel.setAttribute("aria-hidden", String(nextPanel !== "blacklist"));
  }
  if (connectionsPanel) {
    connectionsPanel.setAttribute("aria-hidden", String(nextPanel !== "connections"));
  }
  if (!nextPanel) {
    if (prevPanel === "blacklist") {
      blacklistButton?.focus();
    } else if (prevPanel === "connections") {
      connectionsButton?.focus();
    }
    return;
  }
  if (nextPanel === "blacklist") {
    (addBlacklistRuleButton || blacklistPanel)?.focus();
  } else if (nextPanel === "connections") {
    (serverInputEl || connectionsPanel)?.focus();
  }
}
function renderCards(items) {
  if (!mediaRoot || !template) return;
  mediaRoot.innerHTML = "";
  items.forEach((item) => {
    const blueprint = template.content.firstElementChild;
    if (!blueprint) return;
    const clone = blueprint.cloneNode(true);
    const titleEl = clone.querySelector(".media-card__title");
    const statusEl2 = clone.querySelector(".media-card__status");
    const subtitleEl = clone.querySelector(".media-card__subtitle");
    const metaEl = clone.querySelector(".media-card__meta");
    const timeEl = clone.querySelector(".media-card__time");
    const linkEl = clone.querySelector(".media-card__link");
    const progressBar = clone.querySelector(".media-card__progress-bar");
    clone.classList.toggle("playing", !!item.isPlaying);
    clone.classList.toggle("paused", !item.isPlaying);
    titleEl.textContent = item.title || item.pageUrl || "Unknown media";
    statusEl2.textContent = item.isPlaying ? "Playing" : "Paused";
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
    subtitleEl.textContent = subtitleBits.join(" \xB7 ") || "";
    const metaBits = [];
    const resolution = formatResolution(item.videoWidth, item.videoHeight);
    metaBits.push(`Speed ${formatRate(item.playbackRate)}x`);
    metaBits.push(`Volume ${formatVolume(item.volume, item.muted)}`);
    if (resolution) metaBits.push(resolution);
    if (item.pictureInPicture) metaBits.push("PiP");
    metaEl.textContent = metaBits.filter(Boolean).join(" \xB7 ");
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
function syncServersFromPayload(payload) {
  if (payload && Array.isArray(payload.endpoints)) {
    serverEndpoints = normalizeEndpointList(payload.endpoints);
  }
  if (payload && payload.connections) {
    connectionStatuses = normalizeConnections(payload.connections);
  }
  renderServers();
}
function handleSnapshot(payload) {
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
  setStatus(parts.filter(Boolean).join(" \xB7 "));
}
function handleMessage(message) {
  if (message?.type === "media-state-snapshot") {
    handleSnapshot(message.payload);
  } else if (message?.type === "server-endpoints") {
    syncServersFromPayload(message.payload);
  }
}
renderServers();
try {
  port = chrome.runtime.connect({ name: DASHBOARD_PORT });
  setStatus("Connecting\u2026");
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
addBlacklistRuleButton?.addEventListener("click", () => addBlacklistRule());
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
    if (!Object.prototype.hasOwnProperty.call(changes, BLACKLIST_STORAGE_KEY)) {
      return;
    }
    const normalized = normalizeBlacklistRules(changes[BLACKLIST_STORAGE_KEY].newValue ?? []);
    if (areBlacklistRulesEqual(normalized, blacklistRules)) {
      return;
    }
    blacklistRules = normalized;
    renderBlacklistRules();
  });
}
//# sourceMappingURL=popup.js.map
