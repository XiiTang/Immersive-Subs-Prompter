import { log, state } from "../content/state.js";

const URL_FALLBACK_INTERVAL_MS = 10000;

function notifyUrlChange(onUrlChanged) {
  const currentUrl = location.href;
  if (state.lastPageUrl === currentUrl) {
    return;
  }
  state.lastPageUrl = currentUrl;
  log.info("page", "URL changed", { url: currentUrl, title: document.title });
  if (typeof onUrlChanged === "function") {
    onUrlChanged(currentUrl, document.title);
  }
}

function addListener(target, eventName, handler) {
  target.addEventListener(eventName, handler);
  state.urlWatcherCleanups.push(() => target.removeEventListener(eventName, handler));
}

function patchHistoryMethod(methodName, handler) {
  const original = history?.[methodName];
  if (typeof original !== "function") {
    return;
  }
  const patched = function (...args) {
    const result = original.apply(this, args);
    handler();
    return result;
  };
  patched.toString = () => original.toString();
  history[methodName] = patched;
  state.urlWatcherCleanups.push(() => {
    history[methodName] = original;
  });
}

function scheduleFallback(onUrlChanged) {
  if (state.urlFallbackTimer) {
    clearTimeout(state.urlFallbackTimer);
  }
  state.urlFallbackTimer = window.setTimeout(() => {
    notifyUrlChange(onUrlChanged);
    scheduleFallback(onUrlChanged);
  }, URL_FALLBACK_INTERVAL_MS);
}

export function ensureUrlWatcher(onUrlChanged) {
  if (state.urlWatcherInitialized) {
    return;
  }
  state.urlWatcherInitialized = true;
  state.urlWatcherCleanups = [];

  const handleUrlChange = () => notifyUrlChange(onUrlChanged);

  addListener(window, "popstate", handleUrlChange);
  addListener(window, "hashchange", handleUrlChange);
  ["pushState", "replaceState"].forEach((methodName) => patchHistoryMethod(methodName, handleUrlChange));
  scheduleFallback(onUrlChanged);
}

export function stopUrlWatcher() {
  if (state.urlFallbackTimer) {
    clearTimeout(state.urlFallbackTimer);
    state.urlFallbackTimer = null;
  }
  if (Array.isArray(state.urlWatcherCleanups)) {
    state.urlWatcherCleanups.forEach((cleanup) => {
      try {
        cleanup();
      } catch (error) {
        log.warn("page", "Failed to cleanup URL watcher", error);
      }
    });
  }
  state.urlWatcherCleanups = [];
  state.urlWatcherInitialized = false;
}
