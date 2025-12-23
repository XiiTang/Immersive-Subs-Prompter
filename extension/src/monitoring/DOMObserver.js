import { MEDIA_EVENTS } from "../content/constants.js";
import { log, state } from "../content/state.js";

let mediaEventHandler = null;
let videoRemovedHandler = null;

export function setDomCallbacks({ onMediaEvent, onVideoRemoved } = {}) {
  mediaEventHandler = typeof onMediaEvent === "function" ? onMediaEvent : null;
  videoRemovedHandler = typeof onVideoRemoved === "function" ? onVideoRemoved : null;
}

export function ensureDocListeners(target) {
  if (!target || typeof target.addEventListener !== "function" || state.observedDocs.has(target)) return;
  if (!mediaEventHandler) return;
  state.observedDocs.add(target);
  MEDIA_EVENTS.forEach((eventName) => {
    target.addEventListener(eventName, mediaEventHandler, { capture: true, passive: true });
  });
}

export function getShadowRoot(element) {
  if (!element) return null;
  if (typeof chrome !== "undefined" && chrome.dom && chrome.dom.openOrClosedShadowRoot) {
    try {
      return chrome.dom.openOrClosedShadowRoot(element);
    } catch (err) {
      // Fallback to normal shadowRoot access
    }
  }
  return element.shadowRoot;
}

export function scanForShadowRoots(root = document.body) {
  if (!root || typeof root.querySelectorAll !== "function") return;
  const elements = root.querySelectorAll("*");
  elements.forEach((element) => {
    const shadowRoot = getShadowRoot(element);
    if (shadowRoot && !state.observedDocs.has(shadowRoot)) {
      log.info("shadow", "Found Shadow DOM", { host: element.tagName });
      ensureDocListeners(shadowRoot);
      scanForShadowRoots(shadowRoot);
    }
  });
}

function findVideosInNode(node) {
  const videos = [];
  if (!node) return videos;
  if (node instanceof HTMLVideoElement) {
    videos.push(node);
  }
  if (typeof node.querySelectorAll === "function") {
    node.querySelectorAll("video").forEach((video) => videos.push(video));
  }
  if (node instanceof Element) {
    const shadowRoot = getShadowRoot(node);
    if (shadowRoot && typeof shadowRoot.querySelectorAll === "function") {
      shadowRoot.querySelectorAll("video").forEach((video) => videos.push(video));
    }
  }
  return videos;
}

function handleRemovedNode(node) {
  if (!(node instanceof Element) && !(node instanceof DocumentFragment)) {
    return;
  }

  const videos = findVideosInNode(node);
  videos.forEach((video) => {
    const schedule = typeof requestAnimationFrame === "function"
      ? (fn) => requestAnimationFrame(fn)
      : (fn) => setTimeout(fn, 0);
    schedule(() => {
      if (videoRemovedHandler && video === state.activeVideo && !video.isConnected) {
        videoRemovedHandler();
      }
    });
  });
}

export function startDOMObserver() {
  if (state.domObserver) {
    return state.domObserver;
  }

  const observer = new MutationObserver((mutations) => {
    if (!state.monitoringActive) return;

    mutations.forEach((mutation) => {
      mutation.removedNodes.forEach((node) => handleRemovedNode(node));

      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const shadowRoot = getShadowRoot(node);
          if (shadowRoot && !state.observedDocs.has(shadowRoot)) {
            log.info("shadow", "New Shadow DOM detected via mutation", { host: node.tagName });
            ensureDocListeners(shadowRoot);
            scanForShadowRoots(shadowRoot);
          }
          if (node.querySelectorAll) {
            scanForShadowRoots(node);
          }
        }
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  state.domObserver = observer;
  return observer;
}

export function stopDOMObserver() {
  if (state.domObserver) {
    state.domObserver.disconnect();
    state.domObserver = null;
  }
}

export function prepareDomMonitoring() {
  ensureDocListeners(document);
  log.info("shadow", "Scanning for existing Shadow DOMs...");
  scanForShadowRoots();
}
