import { log, state } from "../content/state";

const URL_FALLBACK_INTERVAL_MS = 10000;

function notifyUrlChange(onUrlChanged?: (url: string, title: string) => void, source = "unknown") {
  const currentUrl = location.href;
  if (state.lastPageUrl === currentUrl) {
    return;
  }
  const oldUrl = state.lastPageUrl;
  state.lastPageUrl = currentUrl;

  log.info("page", "URL changed", {
    source,
    from: oldUrl,
    to: currentUrl,
    title: document.title
  });

  if (typeof onUrlChanged === "function") {
    onUrlChanged(currentUrl, document.title);
  }
}

function addListener(target: Window, eventName: string, handler: EventListener) {
  target.addEventListener(eventName, handler);
  state.urlWatcherCleanups.push(() => target.removeEventListener(eventName, handler));
}

function patchHistoryMethod(methodName: "pushState" | "replaceState", onUrlChanged?: (url: string, title: string) => void) {
  const original = history[methodName];
  if (typeof original !== "function") {
    log.warn("page", `Cannot patch history.${methodName}: not a function`);
    return;
  }
  const patched = function (this: History, ...args: Parameters<History["pushState"]>) {
    const result = original.apply(this, args);
    notifyUrlChange(onUrlChanged, methodName);
    return result;
  };
  patched.toString = () => original.toString();
  history[methodName] = patched;
  state.urlWatcherCleanups.push(() => {
    history[methodName] = original;
  });
}

function scheduleFallback(onUrlChanged?: (url: string, title: string) => void) {
  if (state.urlFallbackTimer) {
    clearTimeout(state.urlFallbackTimer);
  }
  state.urlFallbackTimer = setTimeout(() => {
    notifyUrlChange(onUrlChanged, "fallback");
    scheduleFallback(onUrlChanged);
  }, URL_FALLBACK_INTERVAL_MS);
}

export function ensureUrlWatcher(onUrlChanged?: (url: string, title: string) => void) {
  if (state.urlWatcherInitialized) {
    return;
  }
  state.urlWatcherInitialized = true;
  state.urlWatcherCleanups = [];

  addListener(window, "popstate", () => notifyUrlChange(onUrlChanged, "popstate"));
  addListener(window, "hashchange", () => notifyUrlChange(onUrlChanged, "hashchange"));
  (["pushState", "replaceState"] as const).forEach((methodName) => patchHistoryMethod(methodName, onUrlChanged));
  scheduleFallback(onUrlChanged);

  log.info("page", "URL watcher initialized", {
    mode: "event-driven + fallback",
    fallbackIntervalMs: URL_FALLBACK_INTERVAL_MS
  });
}

export function stopUrlWatcher() {
  if (!state.urlWatcherInitialized) {
    return;
  }

  log.info("page", "Stopping URL watcher");

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

  log.info("page", "URL watcher stopped");
}
