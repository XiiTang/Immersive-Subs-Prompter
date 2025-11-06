const DASHBOARD_PORT = "usp-dashboard";
const statusEl = document.getElementById("status-indicator");
const mediaRoot = document.getElementById("media-root");
const template = document.getElementById("media-card-template");

let port;

function setStatus(text) {
  if (statusEl) {
    statusEl.textContent = text;
  }
}

function formatTime(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "--:--";
  const sign = value < 0 ? "-" : "";
  let secs = Math.abs(value);
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
