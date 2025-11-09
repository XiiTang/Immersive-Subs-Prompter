const DASHBOARD_PORT = "usp-dashboard";
const BLACKLIST_STORAGE_KEY = "uspBlacklistRules";
const statusEl = document.getElementById("status-indicator");
const mediaRoot = document.getElementById("media-root");
const template = document.getElementById("media-card-template");
const blacklistPanel = document.getElementById("blacklist-panel");
const blacklistButton = document.getElementById("blacklist-btn");
const blacklistBackButton = document.getElementById("blacklist-back");
const blacklistListEl = document.getElementById("blacklist-list");
const blacklistEmptyStateEl = document.getElementById("blacklist-empty-state");
const addBlacklistRuleButton = document.getElementById("add-blacklist-rule");

let port;
let blacklistRules = [];

function setStatus(text) {
  if (statusEl) {
    statusEl.textContent = text;
  }
}

function formatTime(value) {
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
  return `${width}×${height}`;
}

function formatRelative(delta) {
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

function normalizeBlacklistRules(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const id = typeof entry.id === "string" && entry.id.length ? entry.id : `rule-${Date.now()}-${index}`;
      const mode =
        typeof entry.mode === "string" && ["contains", "exact", "regex"].includes(entry.mode)
          ? entry.mode
          : "contains";
      const value = typeof entry.value === "string" ? entry.value : "";
      return { id, mode, value };
    })
    .filter(Boolean);
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

function saveBlacklistRules(nextRules) {
  blacklistRules = nextRules;
  renderBlacklistRules();
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
    select.addEventListener("change", () => updateBlacklistRule(rule.id, { mode: select.value }));

    const input = document.createElement("input");
    input.className = "blacklist-item__input";
    input.type = "text";
    input.placeholder = "Enter URL or keywords to match";
    input.value = rule.value;
    input.addEventListener("input", () => updateBlacklistRule(rule.id, { value: input.value }));

    row.appendChild(select);
    row.appendChild(input);

    const footer = document.createElement("div");
    footer.className = "blacklist-item__footer";

    const error = document.createElement("div");
    error.className = "blacklist-item__error";
    error.textContent = rule.mode === "regex" && !isRegexValid(rule.value) ? "Invalid regex" : "";

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
  saveBlacklistRules(nextRules);
}

function removeBlacklistRule(ruleId) {
  const nextRules = blacklistRules.filter((rule) => rule.id !== ruleId);
  saveBlacklistRules(nextRules);
}

function addBlacklistRule() {
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `rule-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const nextRules = [...blacklistRules, { id, mode: "contains", value: "" }];
  saveBlacklistRules(nextRules);
}

function setBlacklistOpen(open) {
  document.body.classList.toggle("blacklist-open", open);
  if (blacklistPanel) {
    blacklistPanel.setAttribute("aria-hidden", String(!open));
  }
  if (open) {
    (addBlacklistRuleButton || blacklistPanel)?.focus();
  } else {
    blacklistButton?.focus();
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
    const statusEl = clone.querySelector(".media-card__status");
    const subtitleEl = clone.querySelector(".media-card__subtitle");
    const metaEl = clone.querySelector(".media-card__meta");
    const timeEl = clone.querySelector(".media-card__time");
    const linkEl = clone.querySelector(".media-card__link");
    const progressBar = clone.querySelector(".media-card__progress-bar");

    clone.classList.toggle("playing", !!item.isPlaying);
    clone.classList.toggle("paused", !item.isPlaying);

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

function handleSnapshot(payload) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!items.length) {
    renderEmptyState();
  } else {
    renderCards(items);
  }
  const delta = payload?.generatedAt ? Date.now() - payload.generatedAt : null;
  const playing = items.filter((item) => item.isPlaying).length;
  const label = playing
    ? `${playing} playing`
    : `${items.length || 0} tracked`;
  setStatus(`${label} · updated ${formatRelative(delta)}`);
}

function handleMessage(message) {
  if (message?.type === "media-state-snapshot") {
    handleSnapshot(message.payload);
  }
}

try {
  port = chrome.runtime.connect({ name: DASHBOARD_PORT });
  setStatus("Connecting…");
  port.onMessage.addListener(handleMessage);
  port.onDisconnect.addListener(() => {
    setStatus("Disconnected");
    renderEmptyState();
  });
} catch (err) {
  console.error("[USP] Failed to connect to dashboard port", err);
  setStatus("Unavailable");
  renderEmptyState();
}

blacklistButton?.addEventListener("click", () => setBlacklistOpen(true));
blacklistBackButton?.addEventListener("click", () => setBlacklistOpen(false));
addBlacklistRuleButton?.addEventListener("click", () => addBlacklistRule());

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("blacklist-open")) {
    setBlacklistOpen(false);
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
    blacklistRules = normalizeBlacklistRules(changes[BLACKLIST_STORAGE_KEY].newValue ?? []);
    renderBlacklistRules();
  });
}
